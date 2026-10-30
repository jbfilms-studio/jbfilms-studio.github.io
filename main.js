;(async () => {
  const loadJSON = async path => {
    const response = await fetch(path)
    if (!response.ok)
      throw new Error(`Unable to load ${path} (${response.status})`)
    return response.json()
  }
  const [pageData, projectData] = await Promise.all([
    loadJSON('content/pages.json'),
    loadJSON('content/projects.json')
  ])
  const siteData = { ...pageData, ...projectData }
  const escapeHTML = value =>
    String(value).replace(
      /[&<>"']/g,
      character =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[character])
    )
  const getVimeoVideoId = videoUrl => {
    const url = new URL(videoUrl)
    if (!['vimeo.com', 'www.vimeo.com'].includes(url.hostname)) return null
    return url.pathname.match(/^\/(\d+)\/?$/)?.[1] || null
  }
  const allPages = siteData.pages
  const pagesBySlug = new Map(allPages.map(item => [item.slug, item]))
  const params = new URLSearchParams(window.location.search)
  const requestedSlug = (params.get('page') || 'home').replace(/^\/+|\/+$/g, '')
  const page = allPages.find(item => item.slug === requestedSlug) || allPages[0]
  const baseSlug = page.slug
  const isPortfolioIndex = baseSlug === 'portfolio'
  const pageUrl = slug => `?page=${encodeURIComponent(slug)}`
  const navItems = [
    { slug: 'home', label: 'Home' },
    { slug: 'about', label: 'About' },
    { slug: 'portfolio', label: 'Portfolio' }
  ]
  const link = (slug, label, current = false) =>
    `<a class="nav-link" href="${pageUrl(slug)}"${
      current ? ' aria-current="page"' : ''
    }>${escapeHTML(label)}</a>`
  const portfolioProjects = siteData.projects
  const projectInfo = portfolioProjects.find(item => item.slug === baseSlug)
  const projectMedia = projectInfo?.media || {}
  const projectVideo = projectInfo?.videoUrl
  const projectVideoLink = projectInfo?.videoLink
  const projectYouTubeId = projectVideoLink
    ? new URL(projectVideoLink).searchParams.get('v')
    : ''
  const showHomeHeroVideo =
    page.type === 'home' && page.showHeroVideo !== false
  const homeHeroVideoId = showHomeHeroVideo
    ? getVimeoVideoId(page.heroVideoUrl)
    : null
  if (showHomeHeroVideo && !homeHeroVideoId)
    throw new Error('Home hero video URL must be a Vimeo video link')
  const header = `<header class="site-header"><nav class="nav-row" aria-label="Main navigation">
    <div class="nav-links">${navItems
      .map(item => link(item.slug, item.label, baseSlug === item.slug))
      .join('')}</div>
    <a class="brand" href="${pageUrl('home')}">JB FILMS</a>
    <div class="nav-actions"><a class="reach-link" href="${pageUrl(
      'contact'
    )}"><span>REACH OUT</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a></div>
    <button class="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button>
    <div class="mobile-menu">${navItems
      .map(item => link(item.slug, item.label, baseSlug === item.slug))
      .join('')}</div>
  </nav></header>`
  const mobileHomeHeading = page.description
    .split(' • ')
    .map(escapeHTML)
    .join('<br>')
  /* Previous YouTube hero embed:
  https://www.youtube.com/embed/-Fr-TTxWIFs?autoplay=1&mute=1&loop=1&playlist=-Fr-TTxWIFs&controls=0&disablekb=1&fs=0&playsinline=1&start=16&rel=0
  */
  const hero =
    page.type === 'home'
      ? `<section class="hero home-hero" id="top">${showHomeHeroVideo ? `<iframe class="home-hero-video" src="https://player.vimeo.com/video/${homeHeroVideoId}?background=1&amp;autoplay=1&amp;muted=1&amp;loop=1&amp;autopause=0&amp;playsinline=1" title="Homepage background video" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" tabindex="-1"></iframe>` : ''}${
          page.heroImage
            ? `<img class="home-hero-poster" src="${escapeHTML(
                page.heroImage
              )}" alt="" aria-hidden="true">`
            : ''
        }<div class="home-hero-content"><h1 class="home-heading-desktop">${escapeHTML(
          page.description
        )}</h1><h1 class="home-heading-mobile">${mobileHomeHeading}</h1></div><a class="scroll-cue" href="#content"><span>Scroll Down</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></a></section>`
      : `<section class="hero" id="top"><div class="hero-content"><p class="eyebrow">${escapeHTML(
          page.type === 'project' ? 'SELECTED FILM' : page.type.toUpperCase()
        )}</p><h1>${escapeHTML(
          page.title
        )}</h1><p class="hero-copy">${escapeHTML(
          page.description
        )}</p></div><a class="scroll-cue" href="#content"><span>Scroll Down</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></a></section>`
  const homeBio = `<section class="home-bio" id="content"><div class="home-bio-inner"><div class="home-bio-divider"></div><h2>Hey, I'm Jaydeep</h2><p>${escapeHTML(
    page.intro
  )}</p><a class="home-bio-button" href="${pageUrl(
    'about'
  )}"><span>Read My Story</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a></div></section>`
  const aboutPage = `<div class="about-page">
    <section class="about-hero"><img src="${page.heroImage || page.image || ''}" alt="Placeholder cinematic image for ${escapeHTML(
    page.title
  )}"></section>
    <section class="about-profile">
      <div class="about-portrait"><img src="${page.image || ''}" alt="Portrait placeholder for ${escapeHTML(
    page.headline || page.title
  )}"></div>
      <div class="about-copy">
        <span class="about-eyebrow">${escapeHTML(
          page.eyebrow || page.title
        )}</span>
        <h1>${escapeHTML(page.headline || page.title)}</h1>
        <div class="about-divider"></div>
        <h2>${escapeHTML(page.description)}</h2>
        ${(page.aboutParagraphs || [])
          .map(paragraph => `<p>${escapeHTML(paragraph)}</p>`)
          .join('')}
        <a class="about-cta" href="${pageUrl(
          'portfolio'
        )}"><span>Watch my work</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>
      </div>
    </section>
  </div>`
  const contactPage = page.type === 'contact' ? `<div class="contact-page">
    <section class="contact-form-container" aria-labelledby="contact-headline">
      <div class="contact-form-content">
        <header class="contact-form-header">
          <h1 class="contact-form-headline" id="contact-headline">${escapeHTML(
            page.contactHeadline
          )}</h1>
          <p class="contact-form-description">${escapeHTML(
            page.contactSubheading
          )}</p>
        </header>
        <!-- <form class="contact-form" data-email="${escapeHTML(page.email)}">
          <div class="contact-form-field"><input class="contact-form-input" type="text" name="name" placeholder="Name" aria-label="Name" autocomplete="name" required></div>
          <div class="contact-form-field"><input class="contact-form-input" type="email" name="email" placeholder="Email" aria-label="Email" autocomplete="email" required></div>
          <div class="contact-form-field"><textarea class="contact-form-textarea" name="message" placeholder="Message" aria-label="Message" rows="5" required></textarea></div>
          <button class="contact-form-button" type="submit">Send Message</button>
        </form> -->
      </div>
    </section>
    <section class="contact-email-section" aria-label="Email contact">
      <div class="contact-email-inner">
        <div class="contact-email-divider" aria-hidden="true"></div>
        <p class="contact-email-intro">${escapeHTML(page.emailIntro)}</p>
        <div class="contact-email-box">
          <a class="contact-email-address" href="mailto:${escapeHTML(
            page.email
          )}">${escapeHTML(page.email)}</a>
          <button class="contact-copy-button" type="button" aria-label="Copy email address" title="Copy email address">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>
        <span class="contact-copy-status" aria-live="polite"></span>
      </div>
    </section>
  </div>` : ''
  const intro = `<section class="section" id="content"><div class="intro reveal"><div class="divider"></div><h2>${escapeHTML(
    page.title
  )}</h2><p class="section-copy">${escapeHTML(
    page.intro
  )}</p><a class="text-link" href="${pageUrl(
    'about'
  )}"><span>Read My Story</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a></div></section>`
  const filters = siteData.portfolioFilters
  const portfolioIntro = (page.portfolioIntro || [])
    .map(part =>
      typeof part === 'string'
        ? escapeHTML(part)
        : `<strong>${escapeHTML(part.emphasis)}</strong>`
    )
    .join('')
  const portfolio = `<div class="portfolio-page">
    <section class="portfolio-intro"><h1>${escapeHTML(page.title)}</h1><p>${portfolioIntro}</p></section>
    <section class="portfolio-showcase" aria-label="Portfolio projects">
      <div class="portfolio-filters" role="group" aria-label="Filter projects">${filters
        .map(
          (filter, index) =>
            `<button class="portfolio-filter${
              index === 0 ? ' is-active' : ''
            }" type="button" data-filter="${filter.slug}" aria-pressed="${
              index === 0
            }">${filter.label}</button>`
        )
        .join('')}</div>
      <div class="portfolio-grid">${portfolioProjects
        .map(project => {
          const projectPage = pagesBySlug.get(project.slug)
          const thumbnail = project.thumbnail || {
            source: projectPage.image,
            alt: `Placeholder image for ${project.title}`
          }
          return `<a class="portfolio-card" href="${pageUrl(
            project.slug
          )}" data-categories="${project.categories.join(
            ' '
          )}"><img src="${thumbnail.source}" alt="${escapeHTML(
            thumbnail.alt
          )}" style="object-position:${escapeHTML(
            thumbnail.position || '50% 50%'
          )}" loading="lazy"><span class="portfolio-card-overlay"><span class="portfolio-card-title">${escapeHTML(
            project.title
          )}</span><span class="portfolio-card-client">${escapeHTML(
            project.client
          )}</span></span></a>`
        })
        .join('')}</div>
    </section>
  </div>`
  const projectImages =
    projectMedia.images || []
  const projectMediaSection =
    projectMedia.type === 'reels'
      ? `<section class="project-reels" aria-label="Project video reels">${Array.from(
          { length: projectMedia.count || 7 },
          () =>
            '<div class="project-reel-placeholder" aria-hidden="true"></div>'
        ).join('')}</section>`
      : `<section class="project-gallery" aria-label="Project photo gallery">${projectImages
          .map(
            (photo, index) =>
              `<figure><img src="${photo}" style="object-position:${escapeHTML(
                projectMedia.imagePositions?.[index] || '50% 50%'
              )}" alt="${escapeHTML(
                projectInfo?.title || page.title
              )} gallery image ${index + 1}" loading="lazy"></figure>`
          )
          .join('')}</section>`
  const posterPosition = projectMedia.poster
    ? projectMedia.posterPosition
    : projectInfo?.thumbnail?.position
  const projectPage = `<div class="project-page">
    <section class="project-detail">
      <h1 class="project-title">${escapeHTML(
        projectInfo?.title || page.title
      )}</h1>
      <div class="project-meta">
        <div class="project-meta-item"><span>Category</span><strong>${escapeHTML(
          projectInfo?.category || 'Documentary'
        )}</strong></div>
        <span class="project-meta-divider" aria-hidden="true"></span>
        <div class="project-meta-item"><span>Client</span><strong>${escapeHTML(
          projectInfo?.client || 'Personal'
        )}</strong></div>
      </div>
      <figure class="project-poster"><img src="${
        projectMedia.poster || projectInfo?.thumbnail?.source || page.image || ''
      }" style="object-position:${escapeHTML(
        posterPosition || '50% 50%'
      )}" alt="${escapeHTML(projectInfo?.title || page.title)} video poster">${
    projectVideoLink || projectVideo
      ? '<button class="project-play" type="button" aria-label="Play project video"><svg viewBox="0 0 18 18" aria-hidden="true"><path d="M4 2.5 15 9 4 15.5z"/></svg></button>'
      : ''
  }</figure>
    </section>
    <section class="project-about">
      <div class="project-description"><h2>About This Project</h2><p>${escapeHTML(
        projectInfo?.about || ''
      )}</p></div>
      <div class="project-credits"><h2>Project Credits</h2><dl>${(
        projectInfo?.credits || [
          { role: 'Director', name: 'Replace with your name' },
          { role: 'Cinematography', name: 'Replace with your name' }
        ]
      )
        .map(
          credit =>
            `<div><dt>${escapeHTML(credit.role)}</dt><dd>${escapeHTML(
              credit.name
            )}</dd></div>`
        )
        .join('')}</dl></div>
    </section>
    ${projectMediaSection}
    ${
      projectVideoLink
        ? `<dialog class="project-video-dialog" aria-label="${escapeHTML(
            projectInfo?.title || page.title
          )} video"><button class="project-video-close" type="button" aria-label="Close video">×</button><iframe data-src="https://www.youtube.com/embed/${escapeHTML(
            projectYouTubeId
          )}?autoplay=1&rel=0" src="about:blank" title="${escapeHTML(
            projectInfo?.title || page.title
          )} video" allow="autoplay; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe></dialog>`
        : projectVideo
        ? `<dialog class="project-video-dialog" aria-label="${escapeHTML(
            projectInfo?.title || page.title
          )} video"><form method="dialog"><button class="project-video-close" aria-label="Close video">×</button></form><video src="${projectVideo}" controls playsinline preload="none"></video></dialog>`
        : ''
    }
  </div>`
  const footer = `<footer class="site-footer"><div class="footer-top-rule"></div><div class="footer-grid"><div class="footer-empty" aria-hidden="true"></div><div class="footer-social"><a href="https://youtube.com/@jbfilms.studio" target="_blank" rel="noreferrer" aria-label="YouTube channel"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12s0-3.9-.5-5.8ZM9.5 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg></a><a href="https://instagram.com/jbfilms.studio" target="_blank" rel="noreferrer" aria-label="Instagram profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5.5"/><circle cx="12" cy="12" r="4.6"/><circle cx="17.5" cy="6.5" r=".7" fill="currentColor" stroke="none"/></svg></a></div><div class="footer-contact"><span>Got a question?</span><button class="footer-email" type="button" aria-label="Copy email address"><span>jbfilms.studio@gmail.com</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M3 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1"/></svg><span class="footer-copy-status" aria-live="polite"></span></button></div></div><div class="footer-bottom"><div class="footer-bottom-rule"></div><span>© ${new Date().getFullYear()} JB Films</span></div></footer>`
  document.documentElement.lang = 'en'
  document.title = `${page.title} | JB Films`
  document.querySelector('meta[name="description"]').content = page.description
  const pageContent = isPortfolioIndex
    ? portfolio
    : page.type === 'project'
    ? projectPage
    : page.type === 'home'
    ? `${hero}${homeBio}`
    : page.type === 'story'
    ? aboutPage
    : page.type === 'contact'
    ? contactPage
    : `${hero}${intro}`
  document.querySelector(
    '#site'
  ).innerHTML = `${header}<main>${pageContent}</main>${footer}`
  const homeHeroVideo = document.querySelector('.home-hero-video')
  const homeHeroPoster = document.querySelector('.home-hero-poster')
  if (homeHeroVideo && homeHeroPoster) {
    if (window.Vimeo?.Player) {
      const player = new window.Vimeo.Player(homeHeroVideo)
      player.on('playing', () => homeHeroPoster.classList.add('is-hidden'))
    } else {
      console.error('The Vimeo Player SDK did not load; the homepage poster will remain visible.')
    }
  }
  if (page.type !== 'home' && page.type !== 'project')
    document
      .querySelector('.hero')
      ?.style.setProperty('background-image', `url("${page.image}")`)
  const menuToggle = document.querySelector('.menu-toggle')
  const mobileMenu = document.querySelector('.mobile-menu')
  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true'
    menuToggle.setAttribute('aria-expanded', String(!isOpen))
    menuToggle.setAttribute('aria-label', isOpen ? 'Open menu' : 'Close menu')
    mobileMenu.classList.toggle('is-open', !isOpen)
  })
  document
    .querySelector('.footer-email')
    .addEventListener('click', async event => {
      const status = event.currentTarget.querySelector('.footer-copy-status')
      try {
        await navigator.clipboard.writeText('jbfilms.studio@gmail.com')
        status.textContent = 'Copied'
      } catch {
        status.textContent = 'Copy unavailable'
      }
    })
  document.querySelector('.contact-form')?.addEventListener('submit', event => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const subject = `Project inquiry from ${formData.get('name')}`
    const body = `Name: ${formData.get('name')}\nEmail: ${formData.get(
      'email'
    )}\n\n${formData.get('message')}`
    window.location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`
  })
  document
    .querySelector('.contact-copy-button')
    ?.addEventListener('click', async event => {
      const status = document.querySelector('.contact-copy-status')
      try {
        await navigator.clipboard.writeText(
          document.querySelector('.contact-email-address').textContent
        )
        status.textContent = 'Copied'
      } catch {
        status.textContent = 'Copy unavailable'
      }
    })
  const playProjectVideo = document.querySelector('.project-play[type=button]')
  const projectVideoDialog = document.querySelector('.project-video-dialog')
  if (playProjectVideo && projectVideoDialog) {
    const video = projectVideoDialog.querySelector('video')
    const youtubeFrame = projectVideoDialog.querySelector('iframe')
    const closeProjectVideo = () => {
      video?.pause()
      if (youtubeFrame) youtubeFrame.src = 'about:blank'
      if (projectVideoDialog.open) projectVideoDialog.close()
    }
    playProjectVideo.addEventListener('click', () => {
      projectVideoDialog.showModal()
      if (youtubeFrame) youtubeFrame.src = youtubeFrame.dataset.src
      video?.play().catch(() => {})
    })
    projectVideoDialog.addEventListener('cancel', event => {
      event.preventDefault()
      closeProjectVideo()
    })
    projectVideoDialog
      .querySelector('.project-video-close')
      .addEventListener('click', event => {
        event.preventDefault()
        closeProjectVideo()
      })
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && projectVideoDialog.open) {
        event.preventDefault()
        closeProjectVideo()
      }
    })
    projectVideoDialog.addEventListener('close', () => video?.pause())
    projectVideoDialog.addEventListener('click', event => {
      if (event.target === projectVideoDialog) closeProjectVideo()
    })
  }
  document.querySelectorAll('.portfolio-filter').forEach(button =>
    button.addEventListener('click', () => {
      const filter = button.dataset.filter
      document.querySelectorAll('.portfolio-filter').forEach(item => {
        const isActive = item === button
        item.classList.toggle('is-active', isActive)
        item.setAttribute('aria-pressed', String(isActive))
      })
      document.querySelectorAll('.portfolio-card').forEach(card => {
        card.hidden =
          filter !== 'all' &&
          !card.dataset.categories.split(' ').includes(filter)
      })
    })
  )
  const observer = new IntersectionObserver(
    entries =>
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      }),
    { threshold: 0.12 }
  )
  document
    .querySelectorAll('.reveal, .home-bio')
    .forEach(element => observer.observe(element))
})().catch(error => {
  console.error(error)
  const site = document.querySelector('#site')
  if (site)
    site.textContent =
      'Unable to load site content. Please try again later.'
})
