const installButtons = document.querySelectorAll('a[href*="releases"]');

installButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (window.plausible) {
      window.plausible('download-clicked');
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const yearSpan = document.createElement('span');
  yearSpan.textContent = ` © ${new Date().getFullYear()}`;
  const footer = document.querySelector('.footer p');

  if (footer) {
    footer.appendChild(yearSpan);
  }
});
