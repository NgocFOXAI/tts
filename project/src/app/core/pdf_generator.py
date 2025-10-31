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
        Convert HTML content to PDF
        
        Args:
            html_content: HTML string to convert
            
        Returns:
            PDF content as bytes
        """
        async with async_playwright() as p:
            # Launch browser in headless mode with larger viewport
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu'
                ]
            )
            
            # Create page with larger viewport for slides
            page = await browser.new_page(viewport={'width': 1920, 'height': 1080})
            
            # Set content and wait for all resources
            await page.set_content(html_content, wait_until="networkidle")
            
            # Wait for Chart.js and other scripts to render
            await page.wait_for_timeout(3000)
            
            # Execute JavaScript to restructure for PDF printing
            await page.evaluate("""
                // Find all slides
                const slides = document.querySelectorAll('.slide, section, [class*="slide"]');
                
                if (slides.length > 0) {
                    // Remove any horizontal scroll containers
                    const containers = document.querySelectorAll('[style*="display: flex"], [style*="overflow"]');
                    containers.forEach(c => {
                        c.style.display = 'block';
                        c.style.overflow = 'visible';
                    });
                    
                    // Make all slides visible and setup for printing
                    slides.forEach((slide, index) => {
                        // Reset positioning
                        slide.style.position = 'relative';
                        slide.style.left = '0';
                        slide.style.right = '0';
                        slide.style.transform = 'none';
                        
                        // Make visible
                        slide.style.display = 'block';
                        slide.style.visibility = 'visible';
                        slide.style.opacity = '1';
                        
                        // Set page break
                        slide.style.pageBreakAfter = 'always';
                        slide.style.pageBreakInside = 'avoid';
                        
                        // Set dimensions for A4 landscape
                        slide.style.width = '100%';
                        slide.style.height = '100vh';
                        slide.style.minHeight = '100vh';
                        slide.style.maxHeight = '100vh';
                        slide.style.boxSizing = 'border-box';
                    });
                    
                    // Hide navigation buttons
                    const navButtons = document.querySelectorAll('button, .navigation, .nav-button, [class*="nav"]');
                    navButtons.forEach(btn => {
                        if (btn.textContent.includes('←') || btn.textContent.includes('→') || btn.textContent.includes('◀') || btn.textContent.includes('▶')) {
                            btn.style.display = 'none';
                        }
                    });
                }
            """)
            
            # Wait a bit more after restructuring
            await page.wait_for_timeout(1500)

            # Inject explicit A4 page CSS so CSS sizes (vw/vh or mm) map to A4 correctly.
            # This helps when the HTML/CSS uses viewport units (100vw/100vh) or expects
            # a full-page slide size. We prefer the CSS page size so the PDF matches
            # the CSS layout instead of Playwright auto-scaling to the paper format.
            await page.add_style_tag(content='''
                @page { size: A4 landscape; margin: 0 }
                html, body { width: 297mm; height: 210mm; margin: 0; padding: 0; }
                /* Force slide elements to match the page box */
                .slide, section, [class*="slide"] {
                    width: 297mm !important;
                    height: 210mm !important;
                    min-height: 210mm !important;
                    max-height: 210mm !important;
                    box-sizing: border-box !important;
                }
            ''')

            # Generate PDF using the CSS page size (preferred) so the output matches
            # the injected @page and fixed mm sizes above.
            pdf_bytes = await page.pdf(
                format="A4",
                landscape=True,
                print_background=True,
                prefer_css_page_size=True,
                scale=1.0,
                margin={
                    "top": "0mm",
                    "right": "0mm",
                    "bottom": "0mm",
                    "left": "0mm"
                }
            )
            
            await browser.close()
            
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
        logger.info(f"✅ HTML saved: {html_path}")
        
        # Generate and save PDF
        try:
            logger.info(f"🔄 Starting PDF generation...")
            pdf_bytes = await self.html_to_pdf(html_content)
            pdf_size = len(pdf_bytes)
            logger.info(f"✅ PDF generated: {pdf_size:,} bytes")
            
            with open(pdf_path, 'wb') as f:
                f.write(pdf_bytes)
            logger.info(f"✅ PDF saved: {pdf_path}")
            
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
