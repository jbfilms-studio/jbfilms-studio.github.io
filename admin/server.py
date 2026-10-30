import argparse
import json
import mimetypes
import os
import re
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ADMIN_DIR = Path(__file__).resolve().parent
ROOT_DIR = ADMIN_DIR.parent
PROJECTS_DIR = ROOT_DIR / "projects"
PROJECTS_FILE = ROOT_DIR / "content" / "projects.json"
POSITION_PATTERN = re.compile(
    r"^\s*(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*$"
)
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class RequestError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def read_projects():
    with PROJECTS_FILE.open("r", encoding="utf-8", newline="") as file:
        contents = file.read()
    return contents, json.loads(contents)


def json_response(handler, status, value):
    body = json.dumps(value, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


class AdminHandler(BaseHTTPRequestHandler):
    server_version = "LocalGalleryCropEditor/1.0"

    def do_GET(self):
        parsed_url = urlsplit(self.path)
        if parsed_url.path == "/":
            self.send_file(ADMIN_DIR / "index.html", "text/html; charset=utf-8")
        elif parsed_url.path in ("/editor.css", "/editor.js"):
            filename = parsed_url.path.lstrip("/")
            media_type = (
                "text/css; charset=utf-8"
                if filename.endswith(".css")
                else "text/javascript; charset=utf-8"
            )
            self.send_file(ADMIN_DIR / filename, media_type)
        elif parsed_url.path == "/api/projects":
            try:
                _, data = read_projects()
                json_response(self, 200, data)
            except (OSError, json.JSONDecodeError) as error:
                json_response(self, 500, {"error": f"Unable to read projects.json: {error}"})
        elif parsed_url.path.startswith("/images/"):
            self.send_project_image(parsed_url.path[len("/images/"):])
        else:
            json_response(self, 404, {"error": "Not found"})

    def do_POST(self):
        if urlsplit(self.path).path != "/api/save":
            json_response(self, 404, {"error": "Not found"})
            return

        try:
            self.validate_local_request()
            payload = self.read_payload()
            self.save_positions(payload)
        except RequestError as error:
            json_response(self, error.status, {"error": str(error)})
        except (OSError, json.JSONDecodeError) as error:
            json_response(self, 500, {"error": f"Unable to save projects.json: {error}"})
        else:
            json_response(self, 200, {"saved": True})

    def validate_local_request(self):
        host = urlsplit("//" + self.headers.get("Host", "")).hostname
        if host not in ("localhost", "127.0.0.1"):
            raise RequestError(403, "The editor accepts requests from localhost only.")

        origin = self.headers.get("Origin")
        if origin:
            parsed_origin = urlsplit(origin)
            if (
                parsed_origin.scheme != "http"
                or parsed_origin.hostname not in ("localhost", "127.0.0.1")
                or parsed_origin.port != self.server.server_port
            ):
                raise RequestError(403, "Cross-origin save requests are not allowed.")

        if self.headers.get_content_type() != "application/json":
            raise RequestError(415, "Send the save request as application/json.")

    def read_payload(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise RequestError(400, "Invalid request length.") from error
        if content_length <= 0 or content_length > 65536:
            raise RequestError(413, "The save request is empty or too large.")

        try:
            payload = json.loads(self.rfile.read(content_length))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise RequestError(400, "The save request contains invalid JSON.") from error
        if not isinstance(payload, dict):
            raise RequestError(400, "The save request must be a JSON object.")
        return payload

    def save_positions(self, payload):
        slug = payload.get("slug")
        thumbnail_position = payload.get("thumbnailPosition")
        poster_position = payload.get("posterPosition")
        image_positions = payload.get("imagePositions")
        if not isinstance(slug, str) or not SLUG_PATTERN.fullmatch(slug):
            raise RequestError(400, "Invalid project slug.")
        if not isinstance(image_positions, list):
            raise RequestError(400, "imagePositions must be an array.")

        all_positions = [thumbnail_position, poster_position, *image_positions]
        for position in all_positions:
            if not isinstance(position, str):
                raise RequestError(400, "Each image position must be a string.")
            match = POSITION_PATTERN.fullmatch(position)
            if not match or any(float(axis) > 100 for axis in match.groups()):
                raise RequestError(
                    400, "Positions must use horizontal and vertical percentages from 0% to 100%."
                )

        contents, data = read_projects()
        matches = [
            project for project in data.get("projects", [])
            if project.get("slug") == slug
        ]
        if len(matches) != 1:
            raise RequestError(404, "Project was not found or its slug is not unique.")

        project = matches[0]
        media = project.get("media")
        thumbnail = project.get("thumbnail")
        if (
            not isinstance(thumbnail, dict)
            or not isinstance(media, dict)
            or not isinstance(media.get("images"), list)
        ):
            raise RequestError(400, "This project is missing its image data.")
        if len(image_positions) != len(media["images"]):
            raise RequestError(
                400,
                f"Expected {len(media['images'])} gallery positions for this project.",
            )

        updated_contents = replace_project_positions(
            contents,
            slug,
            thumbnail_position,
            poster_position,
            image_positions,
        )
        temporary_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                newline="",
                dir=ADMIN_DIR,
                prefix=".projects-",
                suffix=".tmp",
                delete=False,
            ) as temporary_file:
                temporary_path = Path(temporary_file.name)
                temporary_file.write(updated_contents)
                temporary_file.flush()
                os.fsync(temporary_file.fileno())
            os.replace(temporary_path, PROJECTS_FILE)
        finally:
            if temporary_path and temporary_path.exists():
                temporary_path.unlink()

    def send_project_image(self, image_path):
        relative_path = Path(unquote(image_path))
        if relative_path.is_absolute() or ".." in relative_path.parts:
            json_response(self, 400, {"error": "Invalid image path."})
            return
        image_file = (PROJECTS_DIR / relative_path).resolve()
        try:
            image_file.relative_to(PROJECTS_DIR.resolve())
        except ValueError:
            json_response(self, 400, {"error": "Invalid image path."})
            return
        if not image_file.is_file():
            json_response(self, 404, {"error": "Image not found."})
            return
        media_type = mimetypes.guess_type(image_file.name)[0] or "application/octet-stream"
        self.send_file(image_file, media_type)

    def send_file(self, path, media_type):
        try:
            body = path.read_bytes()
        except OSError:
            json_response(self, 404, {"error": "File not found."})
            return
        self.send_response(200)
        self.send_header("Content-Type", media_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format_string, *args):
        print("%s - %s" % (self.address_string(), format_string % args))


def replace_project_positions(
    contents, slug, thumbnail_position, poster_position, image_positions
):
    decoder = json.JSONDecoder()
    project_data = json.loads(contents)
    projects = project_data.get("projects", [])
    projects_key = re.search(r'"projects"\s*:\s*\[', contents)
    if not projects_key:
        raise RequestError(500, "Could not locate the projects array in projects.json.")
    cursor = projects_key.end()
    selected_object = None
    for candidate in projects:
        while cursor < len(contents) and contents[cursor] in " \t\r\n,":
            cursor += 1
        if cursor >= len(contents) or contents[cursor] != "{":
            raise RequestError(500, "Could not locate a project entry in projects.json.")
        parsed_candidate, end = decoder.raw_decode(contents, cursor)
        if parsed_candidate.get("slug") == slug:
            selected_object = (cursor, end)
            break
        cursor = end
    if selected_object is None:
        raise RequestError(500, "Could not locate the selected project in projects.json.")

    project_start, project_end = selected_object
    line_ending = "\r\n" if "\r\n" in contents else "\n"

    def object_range(parent_start, parent_end, name):
        match = re.search(
            rf'"{re.escape(name)}"\s*:\s*\{{',
            contents[parent_start:parent_end],
        )
        if not match:
            raise RequestError(500, f"Could not locate the project's {name} object.")
        start = parent_start + match.end() - 1
        _, end = decoder.raw_decode(contents, start)
        return start, end

    def property_value_range(object_start, object_end, name, expected_type):
        match = re.search(
            rf'"{re.escape(name)}"\s*:\s*',
            contents[object_start:object_end],
        )
        if not match:
            raise RequestError(500, f"Could not locate the project's {name} value.")
        start = object_start + match.end()
        value, end = decoder.raw_decode(contents, start)
        if not isinstance(value, expected_type):
            raise RequestError(500, f"The project's {name} value has an unexpected type.")
        return start, end

    thumbnail_start, thumbnail_end = object_range(
        project_start, project_end, "thumbnail"
    )
    media_start, media_end = object_range(project_start, project_end, "media")
    thumbnail_value = property_value_range(
        thumbnail_start, thumbnail_end, "position", str
    )
    poster_value = property_value_range(media_start, media_end, "posterPosition", str)
    array_start, array_end = property_value_range(
        media_start, media_end, "imagePositions", list
    )

    array_indent_match = re.search(
        r"\n([ \t]*)\"imagePositions\"",
        contents[max(media_start, array_start - 100):array_start],
    )
    indent = array_indent_match.group(1) if array_indent_match else "        "
    item_indent = indent + "  "
    encoded_array = (
        "["
        + line_ending
        + ("," + line_ending).join(
            item_indent + json.dumps(position, ensure_ascii=False)
            for position in image_positions
        )
        + line_ending
        + indent
        + "]"
    )
    replacements = [
        (*thumbnail_value, json.dumps(thumbnail_position, ensure_ascii=False)),
        (*poster_value, json.dumps(poster_position, ensure_ascii=False)),
        (array_start, array_end, encoded_array),
    ]
    for start, end, replacement in sorted(replacements, reverse=True):
        contents = contents[:start] + replacement + contents[end:]
    return contents


def main():
    parser = argparse.ArgumentParser(description="Run the local gallery crop editor.")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    server = HTTPServer(("127.0.0.1", args.port), AdminHandler)
    print(f"Local gallery crop editor: http://localhost:{args.port}/?page=tether")
    print("Press Ctrl+C to stop the server.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping local editor.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
