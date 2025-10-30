#!/usr/bin/env python3
"""
Setup Playwright for NotebookLM automation
"""

import subprocess
import sys
import os

def run_command(command, description):
    """Run a command and print the result"""
    print(f"[INFO] {description}...", flush=True)
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"[SUCCESS] {description} completed successfully", flush=True)
            if result.stdout:
                print(f"   Output: {result.stdout.strip()}", flush=True)
            return True
        else:
            print(f"[ERROR] {description} failed", flush=True)
            if result.stderr:
                print(f"   Error: {result.stderr.strip()}", flush=True)
            return False
    except Exception as e:
        print(f"[ERROR] {description} failed with exception: {e}", flush=True)
        return False

def check_playwright():
    """Check if Playwright is installed and working"""
    print("[INFO] Checking Playwright installation...", flush=True)
    
    try:
        from playwright.sync_api import sync_playwright
        print("[SUCCESS] Playwright Python library is installed", flush=True)
        
        # Check if browsers are installed
        with sync_playwright() as p:
            try:
                browser_path = p.chromium.executable_path
                if browser_path and os.path.exists(browser_path):
                    print(f"[SUCCESS] Chromium browser found: {browser_path}", flush=True)
                    return True
                else:
                    print("[ERROR] Chromium browser not found", flush=True)
                    return False
            except Exception as e:
                print(f"[ERROR] Browser check failed: {e}", flush=True)
                return False
                
    except ImportError:
        print(" Playwright not installed")
        return False

def install_playwright():
    """Install Playwright and browsers"""
    print("🔧 Installing Playwright...")
    
    # Install Playwright Python package
    if not run_command(f"{sys.executable} -m pip install playwright==1.55.0", 
                      "Installing Playwright Python package"):
        return False
    
    # Install Playwright browsers
    if not run_command("playwright install chromium", 
                      "Installing Playwright Chromium browser"):
        return False
    
    # Install system dependencies (for Linux)
    if sys.platform.startswith('linux'):
        run_command("playwright install-deps chromium", 
                   "Installing Playwright system dependencies")
    
    return True

def main():
    """Main setup function"""
    print("🎯 Playwright Setup for Automation")
    print("=" * 50)
    
    # Check current installation
    if check_playwright():
        print("\n Playwright is already properly installed!")
        print(" You can now use automation features")
        return
    
    # Install if needed
    print("\n🔧 Playwright needs to be installed...")
    
    if install_playwright():
        print("\n Playwright installation completed!")
        
        # Verify installation
        if check_playwright():
            print(" Installation verified successfully")
            print(" You can now use automation features")
        else:
            print(" Installation verification failed")
            print(" Please try running manually:")
            print("   pip install playwright")
            print("   playwright install chromium")
    else:
        print("\n Playwright installation failed")
        print(" Please try running manually:")
        print("   pip install playwright")
        print("   playwright install chromium")

if __name__ == "__main__":
    main()