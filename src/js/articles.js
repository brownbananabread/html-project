// ============================================
// ARTICLE DATA FUNCTIONS
// ============================================

// Fetch and parse article markdown files
async function fetchArticle(slug) {
  try {
    const response = await fetch(`/assets/articles/${slug}.md`);
    if (!response.ok) return null;

    const text = await response.text();
    return parseArticle(text, slug);
  } catch (error) {
    console.error(`Error fetching article ${slug}:`, error);
    return null;
  }
}

// Parse markdown file with metadata
function parseArticle(markdown, slug) {
  const lines = markdown.split('\n');

  // Extract metadata from the top of the file
  const metadata = {};
  let contentStart = 0;
  let inMetadata = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Title is the first H1
    if (line.startsWith('# ') && !metadata.title) {
      metadata.title = line.substring(2);
      contentStart = i + 1;
      inMetadata = true;
      continue;
    }

    // Parse metadata fields (Category, Read Time, Published, Author)
    if (inMetadata && line.startsWith('**') && line.includes(':**')) {
      const match = line.match(/\*\*(.+?):\*\*\s*(.+)/);
      if (match) {
        const key = match[1].toLowerCase().replace(' ', '_');
        metadata[key] = match[2];
      }
      contentStart = i + 1;
      continue;
    }

    // Stop metadata parsing when we hit content
    if (inMetadata && line && !line.startsWith('**')) {
      break;
    }
  }

  // Extract content (skip title and metadata)
  const content = lines.slice(contentStart).join('\n').trim();

  // Extract excerpt (first paragraph after metadata)
  const excerpt = extractExcerpt(content);

  return {
    slug,
    title: metadata.title || 'Untitled',
    category: metadata.category || 'General',
    categorySlug: (metadata.category || 'general').toLowerCase().replace(/\s+/g, '-'),
    readTime: metadata.read_time || '5 min read',
    date: metadata.published || 'Unknown',
    author: metadata.author || 'ESS Team',
    excerpt,
    content: markdownToHTML(content)
  };
}

// Extract excerpt from content
function extractExcerpt(content) {
  // Find first paragraph after any headings
  const paragraphs = content.split('\n\n');
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('**')) {
      // Get first sentence or first 200 characters
      const firstSentence = trimmed.split('.')[0] + '.';
      return firstSentence.length > 200 ? trimmed.substring(0, 200) + '...' : firstSentence;
    }
  }
  return '';
}

// Simple markdown to HTML converter
function markdownToHTML(markdown) {
  let html = markdown;

  // Convert headings
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-2xl font-semibold text-gray-900 mb-4 mt-6">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-3xl font-semibold text-gray-900 mb-4 mt-8">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-4xl font-semibold text-gray-900 mb-6">$1</h1>');

  // Convert bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Convert lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul class="list-disc list-inside text-gray-700 mb-6 ml-4">$1</ul>');

  // Convert checkboxes
  html = html.replace(/^- \[ \] (.+)$/gm, '<li class="flex items-center"><input type="checkbox" class="mr-2" disabled> $1</li>');
  html = html.replace(/^- \[x\] (.+)$/gm, '<li class="flex items-center"><input type="checkbox" class="mr-2" checked disabled> $1</li>');

  // Convert paragraphs
  const lines = html.split('\n');
  const processed = [];
  let inList = false;
  let inParagraph = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<li>')) {
      if (inParagraph) {
        processed[processed.length - 1] += '</p>';
        inParagraph = false;
      }
      processed.push(line);
      inList = trimmed.startsWith('<ul') || trimmed.startsWith('<li>');
    } else if (trimmed.startsWith('</ul>')) {
      processed.push(line);
      inList = false;
    } else if (trimmed === '') {
      if (inParagraph) {
        processed[processed.length - 1] += '</p>';
        inParagraph = false;
      }
    } else if (!inList && trimmed && !trimmed.startsWith('---')) {
      if (!inParagraph) {
        processed.push('<p class="text-gray-700 mb-6">' + trimmed);
        inParagraph = true;
      } else {
        processed[processed.length - 1] += ' ' + trimmed;
      }
    }
  }

  if (inParagraph) {
    processed[processed.length - 1] += '</p>';
  }

  return processed.join('\n');
}

// Auto-discover all article files using Vite's glob import
// This automatically scans the articles directory at build time
const articleModules = import.meta.glob('/assets/articles/*.md', { as: 'raw', eager: false });

// Get all articles
export async function getAllArticles() {
  // Extract slugs from file paths
  const articleSlugs = Object.keys(articleModules).map(path => {
    const filename = path.split('/').pop();
    return filename.replace('.md', '');
  });

  const articles = await Promise.all(
    articleSlugs.map(slug => fetchArticle(slug))
  );
  return articles.filter(article => article !== null);
}

// Get article by slug
export async function getArticleBySlug(slug) {
  return await fetchArticle(slug);
}

// ============================================
// ARTICLES LISTING PAGE
// ============================================

// Render article cards
function renderArticleCard(article, featured = false) {
  if (featured) {
    return `
      <a class="block group h-full bg-white border border-gray-100 hover:border-blue-500 rounded-3xl shadow-sm hover:shadow-xl overflow-hidden transition-all duration-300" href="/articles?name=${article.slug}">
        <div class="relative overflow-hidden bg-gray-200 h-80">
          <div class="absolute inset-0 bg-gradient-to-t from-blue-900/90 to-transparent"></div>
          <div class="absolute bottom-0 left-0 right-0 p-8">
            <span class="inline-block px-3 py-1 mb-4 text-xs font-medium text-white bg-blue-500 rounded-full">${article.category}</span>
            <h3 class="text-3xl lg:text-4xl font-semibold text-white mb-4">${article.title}</h3>
            <p class="text-white/90 mb-4">${article.excerpt}</p>
            <div class="flex items-center">
              <div class="flex items-center">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="mr-2">
                  <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM10 3C11.66 3 13 4.34 13 6C13 7.66 11.66 9 10 9C8.34 9 7 7.66 7 6C7 4.34 8.34 3 10 3ZM10 17.2C7.5 17.2 5.29 15.92 4 13.98C4.03 11.99 8 10.9 10 10.9C11.99 10.9 15.97 11.99 16 13.98C14.71 15.92 12.5 17.2 10 17.2Z" fill="white"/>
                </svg>
                <span class="text-sm font-medium text-white">${article.author}</span>
              </div>
              <span class="mx-3 text-white">•</span>
              <span class="text-sm text-white">${article.readTime}</span>
              <span class="mx-3 text-white">•</span>
              <span class="text-sm text-white">${article.date}</span>
            </div>
          </div>
        </div>
      </a>
    `;
  }

  return `
    <a class="block group h-full bg-white border border-gray-100 hover:border-blue-500 rounded-3xl shadow-sm hover:shadow-xl overflow-hidden transition-all duration-300" href="/articles?name=${article.slug}">
      <div class="p-6">
        <div class="mb-4">
          <span class="inline-block px-3 py-1 text-xs font-medium text-blue-900 bg-blue-100 rounded-full">${article.category}</span>
        </div>
        <h4 class="text-2xl font-semibold mb-4 group-hover:text-blue-500 transition duration-200">${article.title}</h4>
        <p class="text-gray-600 mb-6 leading-relaxed">${article.excerpt}</p>
        <div class="flex items-center text-sm text-gray-600">
          <span>${article.readTime}</span>
          <span class="mx-2">•</span>
          <span>${article.date}</span>
        </div>
      </div>
    </a>
  `;
}

function renderSidebarCard(article) {
  return `
    <a class="block group p-6 bg-white border border-gray-100 hover:border-blue-500 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300" href="/articles?name=${article.slug}">
      <span class="inline-block px-3 py-1 mb-3 text-xs font-medium text-blue-900 bg-blue-100 rounded-full">${article.category}</span>
      <h4 class="text-xl font-semibold mb-3 group-hover:text-blue-500 transition duration-200">${article.title}</h4>
      <p class="text-gray-600 text-sm mb-4 leading-relaxed">${article.excerpt}</p>
      <div class="flex items-center text-sm text-gray-600">
        <span>${article.readTime}</span>
        <span class="mx-2">•</span>
        <span>${article.date}</span>
      </div>
    </a>
  `;
}

// Render all articles
async function renderArticlesList() {
  const articles = await getAllArticles();

  if (articles.length === 0) {
    document.getElementById('articles-container').innerHTML = `
      <div class="text-center py-12">
        <p class="text-xl text-gray-600">No articles found.</p>
      </div>
    `;
    return;
  }

  // Sort articles by date (most recent first)
  articles.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Get featured articles (first 3)
  const featuredArticles = articles.slice(0, 3);
  const regularArticles = articles.slice(3);

  // Render featured section
  const featuredHtml = `
    <div class="flex flex-wrap -mx-4 mb-16">
      <div class="w-full lg:w-2/3 px-4 mb-8 lg:mb-0">
        ${renderArticleCard(featuredArticles[0], true)}
      </div>
      <div class="w-full lg:w-1/3 px-4">
        <div class="flex flex-col gap-6">
          ${featuredArticles[1] ? renderSidebarCard(featuredArticles[1]) : ''}
          ${featuredArticles[2] ? renderSidebarCard(featuredArticles[2]) : ''}
        </div>
      </div>
    </div>
  `;

  // Render regular articles grid
  const regularHtml = `
    <div class="flex flex-wrap -mx-4">
      ${regularArticles.map(article => `
        <div class="w-full md:w-1/2 lg:w-1/3 px-4 mb-8">
          ${renderArticleCard(article)}
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('articles-container').innerHTML = featuredHtml + regularHtml;
}

// ============================================
// ARTICLE DETAIL PAGE
// ============================================

// Get the slug from the URL query parameter
function getSlugFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('name') || '';
}

// Render the article post
function renderArticleDetail(post) {
  if (!post) {
    // Article post not found
    document.getElementById('articles-content').innerHTML = `
      <section class="py-24 bg-gray-50">
        <div class="container mx-auto px-4">
          <div class="max-w-3xl mx-auto text-center">
            <h1 class="text-4xl font-semibold text-gray-900 mb-4">Article Not Found</h1>
            <p class="text-lg text-gray-700 mb-8">Sorry, we couldn't find the article you're looking for.</p>
            <a href="/articles" class="inline-flex py-3 px-6 items-center justify-center text-lg font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-full transition duration-200">
              Back to Articles
            </a>
          </div>
        </div>
      </section>
    `;
    return;
  }

  // Update page title
  document.title = `${post.title} - Eternal Safety Solutions`;

  // Render the article post content
  document.getElementById('articles-content').innerHTML = `
    <section class="relative py-12 lg:py-24 bg-blue-900 overflow-hidden">
      <img class="absolute top-0 right-0" src="/assets/images/waves-right-top.png" alt=""/>
      <div class="container mx-auto px-4 relative">
        <div class="max-w-4xl mx-auto">
          <div class="mb-6">
            <a href="/articles" class="inline-flex items-center text-white hover:text-blue-200 transition duration-200">
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Articles
            </a>
          </div>
          <div class="mb-6">
            <span class="inline-block px-3 py-1 text-xs font-medium text-white bg-blue-500 rounded-full">${post.category}</span>
          </div>
          <h1 class="font-heading text-4xl sm:text-5xl lg:text-6xl tracking-xs text-white mb-6">${post.title}</h1>
          <div class="flex flex-wrap items-center gap-4 text-white opacity-90">
            <div class="flex items-center">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="mr-2">
                <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM10 3C11.66 3 13 4.34 13 6C13 7.66 11.66 9 10 9C8.34 9 7 7.66 7 6C7 4.34 8.34 3 10 3ZM10 17.2C7.5 17.2 5.29 15.92 4 13.98C4.03 11.99 8 10.9 10 10.9C11.99 10.9 15.97 11.99 16 13.98C14.71 15.92 12.5 17.2 10 17.2Z" fill="white"/>
              </svg>
              <span class="text-sm font-medium">${post.author}</span>
            </div>
            <span>•</span>
            <span class="text-sm">${post.readTime}</span>
            <span>•</span>
            <span class="text-sm">${post.date}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="py-12 lg:py-24">
      <div class="container mx-auto px-4">
        <article class="max-w-4xl mx-auto">
          <div class="prose prose-lg max-w-none">
            ${post.content}
          </div>

          <div class="mt-12 pt-8 border-t border-gray-200">
            <div class="flex items-center justify-between">
              <a href="/articles" class="inline-flex items-center text-blue-500 hover:text-blue-600 font-medium transition duration-200">
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
                Back to All Articles
              </a>
              <div class="flex gap-3">
                <span class="text-gray-600">Share:</span>
                <a href="#" class="text-gray-600 hover:text-blue-500 transition duration-200">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                  </svg>
                </a>
                <a href="#" class="text-gray-600 hover:text-blue-500 transition duration-200">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section class="py-12 lg:py-24 bg-blue-900">
      <div class="container mx-auto px-4">
        <div class="max-w-4xl mx-auto">
          <div class="bg-white bg-opacity-10 backdrop-blur-sm rounded-3xl p-8 lg:p-12 text-center">
            <h2 class="font-heading text-3xl sm:text-4xl tracking-sm text-white mb-4">Need Expert WHS Guidance?</h2>
            <p class="text-lg text-white opacity-80 mb-8">Our team of safety consultants is ready to help your business achieve compliance and build a stronger safety culture</p>
            <div class="flex flex-col sm:flex-row justify-center gap-4">
              <a class="inline-flex py-4 px-6 items-center justify-center text-lg font-medium text-white border border-blue-500 hover:border-white hover:text-blue-900 bg-blue-500 hover:bg-white rounded-full transition duration-200" href="/contact">Book a Consultation</a>
              <a class="inline-flex py-4 px-6 items-center justify-center text-lg font-medium text-white border border-white hover:border-blue-500 hover:text-blue-900 hover:bg-blue-500 rounded-full transition duration-200" href="/pricing">View Our Services</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

// ============================================
// INITIALIZE BASED ON PAGE
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Check if we're on the articles page
  if (document.getElementById('articles-container') || document.getElementById('articles-content')) {
    const slug = getSlugFromUrl();

    if (slug) {
      // Show article detail view
      const listingView = document.getElementById('articles-listing-view');
      if (listingView) listingView.style.display = 'none';

      const post = await getArticleBySlug(slug);
      renderArticleDetail(post);
    } else {
      // Show articles listing view
      const contentView = document.getElementById('articles-content');
      if (contentView) contentView.style.display = 'none';

      await renderArticlesList();
    }
  }
});
