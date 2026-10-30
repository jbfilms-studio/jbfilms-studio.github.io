;(() => {
  const projectSelect = document.querySelector('#project-select')
  const saveButton = document.querySelector('#save-button')
  const gallery = document.querySelector('#gallery')
  const status = document.querySelector('#status')
  let projects = []
  let activeProject = null
  let entries = []
  let positions = []
  let dirty = false

  const setStatus = (message, state = '') => {
    status.textContent = message
    status.dataset.state = state
  }

  const normalizePosition = value => {
    const match = String(value || '').match(
      /^\s*(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*$/
    )
    if (!match) return { x: 50, y: 50 }
    return {
      x: Math.min(100, Math.max(0, Number(match[1]))),
      y: Math.min(100, Math.max(0, Number(match[2])))
    }
  }

  const formatPosition = position =>
    `${Number(position.x.toFixed(2))}% ${Number(position.y.toFixed(2))}%`

  const portfolioThumbnailAspectRatio = () => {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    let gutter = 20
    if (viewportWidth >= 1024) {
      gutter = Math.min(80, Math.max(52, viewportWidth * 0.0462963))
    } else if (viewportWidth >= 768) {
      gutter = 70
    }

    const columns = viewportWidth <= 600 ? 1 : 2
    const gap = columns === 1 ? 0 : 11.756
    const cardWidth =
      (viewportWidth - gutter * 2 - gap * (columns - 1)) / columns
    const cardHeight = Math.min(
      cardWidth * (9 / 16),
      viewportHeight * 0.3002933535713243
    )
    return cardWidth / cardHeight
  }

  const updateThumbnailPreviewRatio = () => {
    const thumbnailFrame = entries
      .map((entry, index) => ({ entry, frame: gallery.children[index]?.querySelector('.crop-frame') }))
      .find(item => item.entry.type === 'thumbnail')?.frame
    if (thumbnailFrame) {
      thumbnailFrame.style.aspectRatio = String(portfolioThumbnailAspectRatio())
    }
  }

  const savedPositionFor = type => {
    const index = entries.findIndex(entry => entry.type === type)
    return index === -1 ? '50% 50%' : formatPosition(positions[index])
  }

  const savedGalleryPositions = () =>
    entries.reduce((result, entry, index) => {
      if (entry.type === 'gallery') result.push(formatPosition(positions[index]))
      return result
    }, [])

  const markDirty = () => {
    dirty = true
    saveButton.textContent = 'Save positions'
    setStatus('Unsaved crop changes.')
  }

  const updateImage = index => {
    const card = gallery.children[index]
    const image = card.querySelector('img')
    const label = card.querySelector('.position-label')
    const value = formatPosition(positions[index])
    image.style.objectPosition = value
    label.textContent = value
  }

  const attachDrag = (frame, image, index) => {
    let drag = null

    frame.addEventListener('pointerdown', event => {
      if (event.button !== 0) return
      const bounds = frame.getBoundingClientRect()
      const naturalWidth = image.naturalWidth
      const naturalHeight = image.naturalHeight
      if (!naturalWidth || !naturalHeight) return

      const scale = Math.max(
        bounds.width / naturalWidth,
        bounds.height / naturalHeight
      )
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPosition: { ...positions[index] },
        overflowX: Math.max(0, naturalWidth * scale - bounds.width),
        overflowY: Math.max(0, naturalHeight * scale - bounds.height)
      }
      frame.setPointerCapture(event.pointerId)
      event.preventDefault()
    })

    frame.addEventListener('pointermove', event => {
      if (!drag || drag.pointerId !== event.pointerId) return
      const deltaX = event.clientX - drag.startX
      const deltaY = event.clientY - drag.startY
      positions[index] = {
        x: drag.overflowX
          ? Math.min(
              100,
              Math.max(
                0,
                drag.startPosition.x - (deltaX / drag.overflowX) * 100
              )
            )
          : drag.startPosition.x,
        y: drag.overflowY
          ? Math.min(
              100,
              Math.max(
                0,
                drag.startPosition.y - (deltaY / drag.overflowY) * 100
              )
            )
          : drag.startPosition.y
      }
      updateImage(index)
      markDirty()
    })

    const stopDrag = event => {
      if (drag && drag.pointerId === event.pointerId) drag = null
    }
    frame.addEventListener('pointerup', stopDrag)
    frame.addEventListener('pointercancel', stopDrag)
    frame.addEventListener('lostpointercapture', stopDrag)
  }

  const renderProject = slug => {
    activeProject = projects.find(project => project.slug === slug)
    if (!activeProject) {
      gallery.replaceChildren()
      saveButton.disabled = true
      setStatus(`No project matches "${slug}".`, 'error')
      return
    }

    const media = activeProject.media || {}
    const images = Array.isArray(media.images) ? media.images : []
    entries = []
    if (activeProject.thumbnail?.source) {
      entries.push({
        label: 'Portfolio thumbnail',
        source: activeProject.thumbnail.source,
        aspectRatio: '16 / 9',
        position: normalizePosition(activeProject.thumbnail.position),
        type: 'thumbnail'
      })
    }
    if (media.poster) {
      entries.push({
        label: 'Project poster',
        source: media.poster,
        aspectRatio: '2.76 / 1',
        position: normalizePosition(media.posterPosition),
        type: 'poster'
      })
    }
    images.forEach((source, index) => {
      entries.push({
        label: `Gallery image ${String(index + 1).padStart(2, '0')}`,
        source,
        aspectRatio: '2.76 / 1',
        position: normalizePosition(media.imagePositions?.[index]),
        type: 'gallery'
      })
    })
    positions = entries.map(entry => entry.position)
    gallery.replaceChildren()

    entries.forEach((entry, index) => {
      const card = document.createElement('article')
      card.className = 'image-card'
      const title = document.createElement('div')
      title.className = 'image-title'
      title.textContent = entry.label
      const frame = document.createElement('div')
      frame.className = 'crop-frame'
      frame.setAttribute('role', 'group')
      frame.setAttribute('aria-label', `Drag to adjust ${entry.label.toLowerCase()}`)
      frame.style.aspectRatio =
        entry.type === 'thumbnail'
          ? String(portfolioThumbnailAspectRatio())
          : entry.aspectRatio
      const image = document.createElement('img')
      image.src = `/images/${entry.source.replace(/^projects\//, '')}`
      image.alt = ''
      image.draggable = false
      image.style.objectPosition = formatPosition(positions[index])
      const positionLabel = document.createElement('div')
      positionLabel.className = 'position-label'
      positionLabel.textContent = formatPosition(positions[index])
      frame.append(image)
      card.append(title, frame, positionLabel)
      gallery.append(card)
      attachDrag(frame, image, index)
    })

    dirty = false
    saveButton.disabled = false
    saveButton.textContent = 'Save positions'
    setStatus(`${activeProject.title}: drag images to adjust their crops, then save.`)
    history.replaceState(null, '', `/?page=${encodeURIComponent(activeProject.slug)}`)
  }

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects', { cache: 'no-store' })
      if (!response.ok) throw new Error(`Could not load projects (${response.status}).`)
      const data = await response.json()
      if (!Array.isArray(data.projects)) throw new Error('projects.json has no projects array.')
      projects = data.projects
      projectSelect.replaceChildren()
      projects.forEach(project => {
        const option = document.createElement('option')
        option.value = project.slug
        option.textContent = project.title
        projectSelect.append(option)
      })
      const requestedSlug = new URLSearchParams(location.search).get('page')
      const initialProject = projects.find(project => project.slug === requestedSlug)
      projectSelect.value = (initialProject || projects[0]).slug
      projectSelect.disabled = false
      renderProject(projectSelect.value)
    } catch (error) {
      setStatus(error.message, 'error')
    }
  }

  projectSelect.addEventListener('change', () => {
    if (dirty && !window.confirm('Discard unsaved crop changes?')) {
      projectSelect.value = activeProject.slug
      return
    }
    renderProject(projectSelect.value)
  })

  saveButton.addEventListener('click', async () => {
    if (!activeProject || saveButton.disabled) return
    saveButton.disabled = true
    setStatus('Saving positions…')
    try {
      const savedPositions = {
        thumbnailPosition: savedPositionFor('thumbnail'),
        posterPosition: savedPositionFor('poster'),
        imagePositions: savedGalleryPositions()
      }
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: activeProject.slug,
          ...savedPositions
        })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || `Save failed (${response.status}).`)
      activeProject.thumbnail.position = savedPositions.thumbnailPosition
      activeProject.media.posterPosition = savedPositions.posterPosition
      activeProject.media.imagePositions = savedPositions.imagePositions
      dirty = false
      saveButton.textContent = 'Saved'
      setStatus(`${activeProject.title} image positions saved to projects.json.`, 'success')
    } catch (error) {
      setStatus(error.message, 'error')
      saveButton.textContent = 'Retry save'
    } finally {
      saveButton.disabled = false
    }
  })

  window.addEventListener('resize', updateThumbnailPreviewRatio)

  loadProjects()
})()
