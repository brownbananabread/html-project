// Import CSS
import '../css/main.css';

// Show page once CSS is loaded
document.documentElement.style.visibility = 'visible';
document.documentElement.style.opacity = '1';

// Component Loader
async function loadComponent(elementId, componentPath) {
  try {
    const response = await fetch(componentPath);
    if (!response.ok) throw new Error(`Failed to load ${componentPath}`);
    const html = await response.text();
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = html;
    }
  } catch (error) {
    console.error('Error loading component:', error);
  }
}

// Highlight active navigation link
function highlightActiveNavLink() {
  // Get the current page from the URL
  const path = window.location.pathname;
  const pageName = path.split('/').pop().replace('.html', '') || 'index';

  // Select all nav links (desktop and mobile)
  const navLinks = document.querySelectorAll('.nav-link, .nav-link-mobile');

  navLinks.forEach(link => {
    const linkPage = link.getAttribute('data-page');

    if (linkPage === pageName || (pageName === 'index' && linkPage === 'home')) {
      // For regular nav links
      if (link.classList.contains('nav-link') && !link.classList.contains('contact-link')) {
        link.classList.remove('text-blue-900', 'hover:text-blue-700');
        link.classList.add('text-blue-500', 'hover:text-blue-500', 'font-semibold');
      }
      // For contact button
      else if (link.classList.contains('contact-link')) {
        link.classList.remove('text-blue-900', 'hover:text-white', 'border-blue-900', 'hover:bg-blue-900');
        link.classList.add('text-white', 'bg-blue-500', 'border-blue-500', 'hover:bg-blue-500', 'hover:text-white', 'hover:border-blue-500');
      }
      // For mobile nav links
      else if (link.classList.contains('nav-link-mobile')) {
        link.classList.remove('text-blue-900', 'hover:text-blue-700');
        link.classList.add('text-blue-500', 'hover:text-blue-500', 'font-semibold');
      }
    }
  });
}

// Load header and footer components
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    loadComponent('header-placeholder', '/components/header.html'),
    loadComponent('footer-placeholder', '/components/footer.html')
  ]);

  // Highlight active nav link after header is loaded
  highlightActiveNavLink();
});

// Application code
console.log('Quantam HTML Project initialized');
