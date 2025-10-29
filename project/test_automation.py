#!/usr/bin/env python3
"""
Test NotebookLM automation với browser hiện ra để login lần đầu
"""
import sys
import os

# Add paths
project_root = os.path.dirname(__file__)
src_path = os.path.join(project_root, 'src')
sys.path.insert(0, project_root)
sys.path.insert(0, src_path)

from src.app.core.flow.automate import run_notebooklm_automation

if __name__ == "__main__":
    print("=" * 60)
    print("Testing NotebookLM Automation - Browser will appear")
    print("=" * 60)
    
    test_text = """
    Đây là văn bản test để thử nghiệm tính năng NotebookLM automation.
    Automation sẽ mở browser Chromium, bạn có thể login Google lần đầu.
    Session sẽ được lưu lại để lần sau không cần login nữa.
    """
    
    print(f"\nTest text length: {len(test_text)} characters")
    print("\nStarting automation...")
    print("Browser sẽ hiện ra, hãy login Google nếu cần!\n")
    
    result = run_notebooklm_automation(
        content_source=test_text,
        debug_mode=True,  # Show browser
        max_wait_minutes=10
    )
    
    print("\n" + "=" * 60)
    if result:
        print(" Automation completed successfully!")
    else:
        print(" Automation failed!")
    print("=" * 60)
    
    input("\nPress Enter to exit...")
