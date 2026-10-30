# Local gallery crop editor

This tool runs only on your computer. It updates only the selected project's crop positions in `content/projects.json`: `thumbnail.position`, `media.posterPosition`, and the values in `media.imagePositions`. Other project data is preserved.

From the project folder, start it with:

```powershell
python admin\server.py
```

Then open `http://localhost:8000/?page=tether` in your browser. Select a different project from the menu, drag each thumbnail, poster, or gallery photo within its frame, and choose **Save positions**. The thumbnail preview matches the portfolio card ratio for the current browser viewport, including the site's 16:9 ratio and 30vh maximum height; posters and gallery images use the site's 2.76:1 ratio.

If port 8000 is already occupied by another local server, start the editor on another port, for example `python admin\server.py --port 8001`, then open `http://localhost:8001/?page=tether`.

The server binds to `127.0.0.1` and accepts save requests only from localhost. Keep the terminal open while editing; press `Ctrl+C` there to stop the server. Back up `content/projects.json` before editing if you want an easy manual restore point.
