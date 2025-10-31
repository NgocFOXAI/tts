"""
Test script to verify Gemini-generated meaningful filenames for dashboard slides
"""
import asyncio
from app.core.pdf_generator import PDFGenerator

async def test_gemini_filename():
    """Test Gemini filename generation"""
    pdf_gen = PDFGenerator()
    
    # Sample HTML content
    html_content = """
    <!DOCTYPE html>
    <html>
    <head><title>Test Slide</title></head>
    <body>
        <div class="slide">
            <h1>Sales Performance Q4 2024</h1>
            <p>Revenue increased by 25% compared to last quarter</p>
        </div>
    </body>
    </html>
    """
    
    # Test with context
    context = "Create a presentation about Q4 2024 sales performance showing 25% revenue growth"
    
    print("Testing Gemini filename generation...")
    print(f"Context: {context}")
    print("-" * 80)
    
    result = await pdf_gen.save_dashboard_file(
        html_content=html_content,
        content_context=context
    )
    
    print("\nResult:")
    print(f"Filename: {result['filename']}")
    print(f"HTML URL: {result['html_url']}")
    print(f"PDF URL: {result['pdf_url']}")
    print("-" * 80)
    print("Test completed!")

if __name__ == "__main__":
    asyncio.run(test_gemini_filename())
