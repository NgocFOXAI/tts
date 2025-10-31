from playwright.async_api import async_playwright
import os
from pathlib import Path
from datetime import datetime
import uuid
import logging

logger = logging.getLogger(__name__)


class PDFGenerator:
    """Service for converting HTML to PDF using Playwright"""
    
    def __init__(self):
        # Dashboard directory for storing files
        self.dashboard_dir = Path(__file__).parent.parent.parent / "static" / "dashboard"
        os.makedirs(self.dashboard_dir, exist_ok=True)
    
    async def html_to_pdf(self, html_content: str) -> bytes:
        """
        Convert HTML content to PDF using Playwright best practices
        
        Args:
            html_content: HTML string to convert
            
        Returns:
            PDF content as bytes
        """
        async with async_playwright() as p:
            # Launch browser with optimized flags for PDF generation
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',  # Allow loading external resources
                    '--font-render-hinting=none'  # Better font rendering
                ]
            )
            
            # Create page with A4 landscape viewport (matches common slide size)
            # A4 landscape at 96 DPI: ~1122px x 793px
            page = await browser.new_page(
                viewport={'width': 1122, 'height': 793},
                device_scale_factor=2  # Higher DPI for better quality
            )
            
            # Emulate print media for CSS @media print
            await page.emulate_media(media='print')
            
            # Set content and wait for network to be idle
            await page.set_content(html_content, wait_until="networkidle")
            
            # Wait for Chart.js to render - check for canvas elements
            try:
                await page.wait_for_selector('canvas', timeout=5000)
                # Wait for Chart.js initialization
                await page.evaluate("""
                    () => new Promise(resolve => {
                        if (typeof Chart !== 'undefined') {
                            // Chart.js loaded, wait for all charts to render
                            setTimeout(resolve, 2000);
                        } else {
                            resolve();
                        }
                    })
                """)
            except:
                # No charts, just wait a bit
                await page.wait_for_timeout(1000)
            
            # Analyze HTML format to determine PDF settings
            format_info = await page.evaluate("""
                () => {
                    // Find all slides
                    const slides = document.querySelectorAll('.slide, section, [class*="slide"]');
                    
                    if (slides.length === 0) {
                        return { slideCount: 0, format: 'unknown' };
                    }
                    
                    console.log(`[PDF Gen] Found ${slides.length} slides`);
                    
                    // Get first slide to detect format
                    const firstSlide = slides[0];
                    const computedStyle = window.getComputedStyle(firstSlide);
                    const slideWidth = computedStyle.width;
                    const slideHeight = computedStyle.height;
                    const position = computedStyle.position;
                    
                    console.log(`[PDF Gen] First slide: ${slideWidth} x ${slideHeight}, position: ${position}`);
                    
                    // Make all slides visible for PDF printing and check overflow
                    const overflowWarnings = [];
                    slides.forEach((slide, index) => {
                        // Only ensure visibility - DO NOT touch dimensions
                        if (slide.style.display === 'none' || computedStyle.display === 'none') {
                            slide.style.display = computedStyle.display === 'flex' ? 'flex' : 'block';
                        }
                        slide.style.visibility = 'visible';
                        slide.style.opacity = '1';
                        
                        // Check for content overflow
                        const slideHeight = slide.offsetHeight;
                        const maxHeight = 793; // A4 landscape height in pixels at 96 DPI (210mm)
                        if (slideHeight > maxHeight) {
                            console.warn(`[PDF Gen] ⚠️ Slide ${index + 1} overflow: ${slideHeight}px > ${maxHeight}px (may be cut off)`);
                            overflowWarnings.push({
                                slideIndex: index + 1,
                                actualHeight: slideHeight,
                                maxHeight: maxHeight
                            });
                            
                            // Add CSS to try to contain content
                            slide.style.maxHeight = `${maxHeight}px`;
                            slide.style.overflow = 'hidden';
                        }
                        
                        // Ensure page breaks (if not already set)
                        if (!slide.style.pageBreakAfter) {
                            slide.style.pageBreakAfter = 'always';
                        }
                        if (!slide.style.pageBreakInside) {
                            slide.style.pageBreakInside = 'avoid';
                        }
                        
                        console.log(`[PDF Gen] Slide ${index + 1}: Visible, breaks set`);
                    });
                    
                    // Hide navigation buttons
                    const navButtons = document.querySelectorAll('button, .navigation, .nav-button, [class*="nav"]');
                    navButtons.forEach(btn => {
                        if (btn.textContent.includes('←') || btn.textContent.includes('→') || 
                            btn.textContent.includes('◀') || btn.textContent.includes('▶')) {
                            btn.style.display = 'none';
                        }
                    });
                    
                    return {
                        slideCount: slides.length,
                        slideWidth: slideWidth,
                        slideHeight: slideHeight,
                        position: position,
                        format: 'detected',
                        overflowWarnings: overflowWarnings
                    };
                }
            """)
            
            logger.info(f"📐 Detected format: {format_info['slideCount']} slides, {format_info.get('slideWidth', 'unknown')} x {format_info.get('slideHeight', 'unknown')}")
            
            # Log overflow warnings if any
            if format_info.get('overflowWarnings'):
                for warning in format_info['overflowWarnings']:
                    logger.warning(f"⚠️ Slide {warning['slideIndex']} overflow: {warning['actualHeight']}px > {warning['maxHeight']}px (content will be truncated)")
            else:
                logger.info(" All slides fit within A4 landscape dimensions")
            
            # Wait a bit more after ensuring visibility
            await page.wait_for_timeout(500)

            # Generate PDF with optimized settings
            # Reference: https://pdforge.com/blog/generate-pdf-from-html-using-playwright-python
            pdf_bytes = await page.pdf(
                format=None,  # Use CSS @page size
                print_background=True,  # Include background colors/images
                prefer_css_page_size=True,  # CRITICAL: Respect @page in CSS
                scale=1.0,  # No scaling
                margin={
                    "top": "0",
                    "right": "0", 
                    "bottom": "0",
                    "left": "0"
                },
                display_header_footer=False  # No headers/footers
            )
            
            await browser.close()
            
            logger.info(f" PDF generated: {len(pdf_bytes):,} bytes")
            return pdf_bytes
    
    async def save_dashboard_file(self, html_content: str, filename: str = None) -> dict:
        """
        Save HTML and PDF to dashboard directory
        
        Args:
            html_content: HTML string to save
            filename: Optional filename (without extension), generates UUID if not provided
            
        Returns:
            Dict with file info: {filename, html_path, pdf_path, created_at}
        """
        # Generate filename if not provided
        if not filename:
            filename = f"slide_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        
        # Sanitize filename
        filename = "".join(c for c in filename if c.isalnum() or c in ('-', '_'))
        
        # Paths
        html_path = self.dashboard_dir / f"{filename}.html"
        pdf_path = self.dashboard_dir / f"{filename}.pdf"
        
        # Log HTML stats
        html_length = len(html_content)
        slide_count = html_content.count('<section') + html_content.count('<div class="slide"')
        logger.info(f"💾 Saving HTML: {filename}")
        logger.info(f"📊 HTML length: {html_length:,} chars")
        logger.info(f"📄 Detected slides: {slide_count}")
        
        # Save HTML first (always succeeds)
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        logger.info(f" HTML saved: {html_path}")
        
        # Generate and save PDF
        try:
            logger.info(f"🔄 Starting PDF generation...")
            pdf_bytes = await self.html_to_pdf(html_content)
            pdf_size = len(pdf_bytes)
            logger.info(f" PDF generated: {pdf_size:,} bytes")
            
            with open(pdf_path, 'wb') as f:
                f.write(pdf_bytes)
            logger.info(f" PDF saved: {pdf_path}")
            
        except Exception as e:
            logger.error(f"❌ PDF generation failed: {e}")
            logger.error(f"HTML was saved, but PDF could not be generated")
            # Continue anyway, HTML is saved
        
        return {
            "filename": filename,
            "html_path": str(html_path),
            "pdf_path": str(pdf_path),
            "html_url": f"/static/dashboard/{filename}.html",
            "pdf_url": f"/static/dashboard/{filename}.pdf",
            "created_at": datetime.now().isoformat()
        }
    
    def list_dashboard_files(self) -> list:
        """
        List all files in dashboard directory
        
        Returns:
            List of file info dicts
        """
        files = []
        
        # Get all HTML files
        for html_file in self.dashboard_dir.glob("*.html"):
            filename = html_file.stem
            pdf_file = self.dashboard_dir / f"{filename}.pdf"
            
            file_info = {
                "filename": filename,
                "html_path": str(html_file),
                "pdf_path": str(pdf_file) if pdf_file.exists() else None,
                "html_url": f"/static/dashboard/{filename}.html",
                "pdf_url": f"/static/dashboard/{filename}.pdf" if pdf_file.exists() else None,
                "created_at": datetime.fromtimestamp(html_file.stat().st_mtime).isoformat(),
                "size_kb": round(html_file.stat().st_size / 1024, 2)
            }
            files.append(file_info)
        
        # Sort by creation time (newest first)
        files.sort(key=lambda x: x["created_at"], reverse=True)
        
        return files
    
    def delete_dashboard_file(self, filename: str) -> bool:
        """
        Delete HTML and PDF files from dashboard
        
        Args:
            filename: Filename (without extension)
            
        Returns:
            True if deleted successfully
        """
        html_path = self.dashboard_dir / f"{filename}.html"
        pdf_path = self.dashboard_dir / f"{filename}.pdf"
        
        deleted = False
        
        if html_path.exists():
            html_path.unlink()
            deleted = True
        
        if pdf_path.exists():
            pdf_path.unlink()
            deleted = True
        
        return deleted


# Global instance
pdf_generator = PDFGenerator()
