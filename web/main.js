const installButtons = document.querySelectorAll('a[href*="releases"]');

installButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (window.plausible) {
      window.plausible('download-clicked');
    }
  });
});

const RELEASES_API_URL = 'https://api.github.com/repos/kdkiss/breakoutpropterminal/releases/latest';

function formatDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return null;
  }

  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function renderReleaseError(container) {
  container.innerHTML = '';

  const message = document.createElement('p');
  message.className = 'release-card__status release-card__status--error';
  message.textContent = 'Unable to load release details right now.';

  const fallback = document.createElement('p');
  fallback.className = 'release-card__status';
  fallback.append('Visit ');

  const fallbackLink = document.createElement('a');
  fallbackLink.href = 'https://github.com/kdkiss/breakoutpropterminal/releases';
  fallbackLink.target = '_blank';
  fallbackLink.rel = 'noopener';
  fallbackLink.textContent = 'GitHub releases';

  fallback.append(fallbackLink, ' to download installers.');

  container.append(message, fallback);
}

function renderRelease(container, release) {
  container.innerHTML = '';

  const heading = document.createElement('h2');
  heading.textContent = release.name || release.tag_name || 'Latest release';
  container.appendChild(heading);

  const meta = document.createElement('p');
  meta.className = 'release-card__meta';

  const publishedDate = formatDate(release.published_at || release.created_at);
  if (publishedDate) {
    meta.textContent = `Published ${publishedDate}`;
  } else {
    meta.textContent = 'Latest release metadata from GitHub.';
  }

  container.appendChild(meta);

  const assets = Array.isArray(release.assets)
    ? release.assets.filter((asset) => Boolean(asset.browser_download_url))
    : [];

  if (assets.length === 0) {
    const status = document.createElement('p');
    status.className = 'release-card__status';
    status.append('No downloadable assets were found. Visit ');

    const link = document.createElement('a');
    link.href =
      release.html_url || 'https://github.com/kdkiss/breakoutpropterminal/releases/latest';
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'GitHub';

    status.append(link, ' for more details.');
    container.appendChild(status);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'release-card__assets';

  for (const asset of assets) {
    const item = document.createElement('li');
    item.className = 'release-card__asset';

    const link = document.createElement('a');
    link.href = asset.browser_download_url;
    link.textContent = asset.name || 'Download asset';
    link.target = '_blank';
    link.rel = 'noopener';

    const metaLine = document.createElement('span');
    metaLine.className = 'release-card__asset-meta';

    const details = [];
    const size = formatFileSize(asset.size);
    if (size) {
      details.push(size);
    }

    if (typeof asset.download_count === 'number') {
      details.push(`${asset.download_count.toLocaleString()} downloads`);
    }

    const updatedDate = formatDate(asset.updated_at);
    if (updatedDate) {
      details.push(`Updated ${updatedDate}`);
    }

    metaLine.textContent = details.join(' • ');

    item.append(link);
    if (details.length > 0) {
      item.appendChild(metaLine);
    }

    list.appendChild(item);
  }

  container.appendChild(list);

  const releaseLink = document.createElement('p');
  releaseLink.className = 'release-card__status';
  releaseLink.append('View full notes on ');

  const releaseAnchor = document.createElement('a');
  releaseAnchor.href =
    release.html_url || 'https://github.com/kdkiss/breakoutpropterminal/releases/latest';
  releaseAnchor.target = '_blank';
  releaseAnchor.rel = 'noopener';
  releaseAnchor.textContent = 'GitHub';

  releaseLink.append(releaseAnchor, '.');
  container.appendChild(releaseLink);
}

async function hydrateLatestRelease() {
  const container = document.querySelector('[data-release-card]');

  if (!container) {
    return;
  }

  const status = container.querySelector('.release-card__status');
  if (status) {
    status.textContent = 'Fetching the latest release…';
  }

  try {
    const response = await fetch(RELEASES_API_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const release = await response.json();
    renderRelease(container, release);
  } catch (error) {
    console.error('Failed to load latest release metadata', error);
    renderReleaseError(container);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const yearSpan = document.createElement('span');
  yearSpan.textContent = ` © ${new Date().getFullYear()}`;
  const footer = document.querySelector('.footer p');

  if (footer) {
    footer.appendChild(yearSpan);
  }

  hydrateLatestRelease();
});
