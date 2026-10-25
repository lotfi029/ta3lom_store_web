/** Share URLs for a page (D-W5). Nothing is loaded from a third party: these are plain links that open in a new tab. */
export function shareLinks(
  url: string,
  title: string,
): { whatsapp: string; x: string; facebook: string } {
  const u = encodeURIComponent(url);
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    x: `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${u}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
  };
}
