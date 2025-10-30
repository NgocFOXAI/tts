#!/usr/bin/env python3

import os
import re
import sys
import time
from typing import Optional

from playwright.sync_api import sync_playwright, expect

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
core_dir = os.path.dirname(current_dir)
app_dir = os.path.dirname(core_dir)
project_dir = os.path.dirname(app_dir)
automation_dir = os.path.join(app_dir, "services", "automation")

sys.path.append(app_dir)
sys.path.append(automation_dir)

# Import settings and login service
from config.settings import settings  # noqa: E402
from services.automation.login_process import perform_google_login  # noqa: E402


def _default_chrome_profile() -> str:
    """Trả về đường dẫn profile mặc định theo OS."""
    # Use fixed shared profile path for consistency between IIS and console
    if sys.platform.startswith("win"):
        # Use a shared location that both IIS and user can access
        shared_profile = r"C:\playwright-browsers\chrome-profile"
        os.makedirs(shared_profile, exist_ok=True)
        return shared_profile
    else:
        # Linux
        home = os.path.expanduser("~")
        return os.path.join(home, ".config", "google-chrome", "Default")


class NotebookLMAutomation:
    """NotebookLM automation handler for text-to-speech workflow."""

    def __init__(
        self,
        debug_mode: bool = False,
        email: Optional[str] = None,
        password: Optional[str] = None,
    ):
        """Initialize automation handler."""
        self.debug_mode = debug_mode

        # Get credentials from settings if not provided
        self.email = email or getattr(settings.gmail, "email", None)
        self.password = password or getattr(settings.gmail, "password", None)
        self.auto_login = getattr(settings.notebooklm, "auto_login", False)

        self.profile_path = _default_chrome_profile()

        # Set up static download folder
        self.static_folder = os.path.join(project_dir, "static")
        self.download_folder = os.path.join(self.static_folder, "audio_downloads")
        self.upload_folder = os.path.join(self.static_folder, "upload_files")
        self.debug_folder = os.path.join(self.static_folder, "debug_screenshots")

        # Create folders if they don't exist
        os.makedirs(self.download_folder, exist_ok=True)
        os.makedirs(self.upload_folder, exist_ok=True)
        os.makedirs(self.debug_folder, exist_ok=True)

        # Log credentials status
        print("🔐 Login credentials loaded:")
        print(f"   Email: {self.email[:15]}..." if self.email else "   Email: Not set")
        print(f"   Password: {'*' * 8}" if self.password else "   Password: Not set")
        print(f"   Auto-login: {self.auto_login}")
        print(f"   Debug mode: {self.debug_mode}")
        print(f"📁 Folders setup:")
        print(f"   Downloads: {self.download_folder}")
        print(f"   Uploads: {self.upload_folder}")
        print(f"   Debug: {self.debug_folder}")


    def perform_reload_and_try_download(self, page, elapsed_time) -> bool:
        """Reload page and try download."""
        try:
            print("🔄 Reloading page...")
            page.reload(wait_until="load", timeout=3000)
            page.wait_for_timeout(2000)

            # Activate page
            try:
                page.locator("body").click(timeout=2000)
            except Exception:
                try:
                    page.keyboard.press("Space")
                except Exception:
                    pass  # Page activation failed, continue anyway

            # Try download using more menu only
            return self.try_download_method(page, "more")

        except Exception as e:
            print(f" Reload error: {e}")
            return False

    def debug_page_state(self, page, step_name: str) -> None:
        """Debug helper - always print URL and take screenshot."""
        try:
            current_url = page.url
            print(f"🔍 DEBUG [{step_name}] URL: {current_url}")
            
            # Take screenshot for debugging in separate debug folder
            screenshot_path = os.path.join(self.debug_folder, f"debug_{step_name}.png")
            page.screenshot(path=screenshot_path)
            print(f"📸 Screenshot saved: {screenshot_path}")
            
            # Also log file input information if available
            try:
                file_inputs = page.locator('input[type="file"]')
                if file_inputs.count() > 0:
                    for i in range(file_inputs.count()):
                        file_input = file_inputs.nth(i)
                        multiple_attr = file_input.get_attribute("multiple")
                        accept_attr = file_input.get_attribute("accept")
                        print(f"📋 File input {i+1}: multiple={multiple_attr}, accept={accept_attr}")
                else:
                    print("📋 No file inputs found on current page")
            except Exception as e:
                print(f"📋 Could not check file inputs: {e}")
                
        except Exception as e:
            print(f"Debug error: {e}")

    def handle_google_login(self, page) -> bool:
        """Handle Google login if credentials are provided."""
        if not self.auto_login:
            print("ℹ️ Auto login disabled - using existing session")
            return True

        if not self.email or not self.password:
            print("ℹ️ No login credentials found in .env - using existing session")
            return True

        try:
            print(f"🔐 Attempting Google login with {self.email}...")

            # Check if already logged in by looking for account indicators
            current_url = page.url.lower()
            if "accounts.google.com" not in current_url and "signin" not in current_url:
                print("ℹ️ Not on login page - may already be logged in")
                return True

            # Perform login
            login_success = perform_google_login(
                page, self.email, self.password, self.debug_mode
            )

            if login_success:
                print("Google login successful")
                # Navigate back to NotebookLM after login
                page.goto(settings.notebooklm.navigation_url)
                page.wait_for_timeout(3000)
            else:
                print("Google login failed")

            return login_success

        except Exception as e:
            print(f"Login error: {e}")
            return False

    def save_temp_file(self, file_content: bytes, filename: str) -> str:
        """Save uploaded file to temporary upload folder and return path."""
        try:
            # Generate safe filename
            safe_filename = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', filename)
            timestamp = int(time.time())
            unique_filename = f"{timestamp}_{safe_filename}"
            
            file_path = os.path.join(self.upload_folder, unique_filename)
            
            with open(file_path, 'wb') as f:
                f.write(file_content)
            
            print(f"📁 File saved to: {file_path}")
            return file_path
        except Exception as e:
            print(f" Error saving file: {e}")
            return None

    def get_content(self, content_source: str) -> Optional[str]:
        """Get content from either direct text or file (hiện dùng direct text)."""
        print("📤 Processing content source...")

        if isinstance(content_source, str) and len(content_source.strip()) > 10:
            print(f"Using direct text content ({len(content_source)} chars)")
            return content_source.strip()

        print(f"Invalid content source (too short or not text): {content_source}")
        print(" Content must be at least 10 characters long")
        return None

    def upload_content_to_notebooklm(self, page, content: str, file_paths: list = None) -> bool:
        """Upload content to NotebookLM - either text or multiple files."""
        try:
            # Navigate to NotebookLM
            print("🌐 Navigating to NotebookLM...")
            page.goto(settings.notebooklm.navigation_url)
            page.wait_for_timeout(3000)

            # Handle login if needed
            if not self.handle_google_login(page):
                print("Login failed - cannot proceed")
                return False

            page.wait_for_timeout(2000)

            # Create new
            print("📋 Creating new...")
            # Try multiple selectors based on actual HTML structure
            create_selectors = [
                # Aria-label selectors (most reliable)
                'button[aria-label="Create new notebook"]',
                'button[aria-label*="Create new"]',
                
                # Class-based selectors
                'button.create-new-button',
                '.create-new-button',
                
                # Text content selectors
                'text="Create new"',
                'text="Tạo mới"',
                
                # Combined selectors for better accuracy
                'button:has-text("Create new")',
                'button mat-icon[data-mat-icon-type="font"]:has-text("add") ~ .mdc-button__label',
                
                # Specific span selector
                'span.create-new-label',
                '.create-new-label',
                
                # Material Design button selectors
                'button[mat-flat-button]:has-text("Create new")',
                'button.mat-mdc-unelevated-button:has-text("Create new")',
                
                # Icon + text combination
                'button:has(mat-icon):has-text("Create new")',
                'button:has([data-mat-icon-type="font"]):has-text("Create new")',
                
                # Fallback xpath
                'xpath=/html/body/labs-tailwind-root/div/welcome-page/div/div[1]/div/div[2]/div/div/button/span[2]/span'
            ]

            create_clicked = False
            for selector in create_selectors:
                try:
                    btn = page.locator(selector).first
                    if btn.count() > 0:
                        btn.click()
                        create_clicked = True
                        print(f"Clicked create button with: {selector}")
                        break
                except:
                    continue

            if not create_clicked:
                print(" Could not find Create new button")
                self.debug_page_state(page, "01_no_create_button")
                return False

            page.wait_for_timeout(2000)
            self.debug_page_state(page, "02_after_create_click")

            # Decide between file upload or text input
            if file_paths and len(file_paths) > 0:
                # Upload all files to the same notebook session
                print(f"📎 Uploading {len(file_paths)} files to the same notebook...")
                return self._upload_multiple_files_to_notebooklm(page, file_paths)
            else:
                return self._upload_text_to_notebooklm(page, content)

        except Exception as e:
            print(f"Upload error: {e}")
            self.debug_page_state(page, "upload_error")
            return False

    def _upload_multiple_files_to_notebooklm(self, page, file_paths: list) -> bool:
        """Upload multiple files to the same NotebookLM session."""
        try:
            print(f"📎 Starting multiple file upload for {len(file_paths)} files...")
            
            # Try to upload all files at once using the file chooser
            if self._upload_all_files_at_once(page, file_paths):
                print(f" Successfully uploaded all {len(file_paths)} files at once!")
                return True
            
            # Fallback: Upload first file to create the notebook, then add others
            print("🔄 Falling back to sequential upload...")
            first_file = file_paths[0]
            print(f"📎 Uploading first file: {os.path.basename(first_file)}...")
            if not self._upload_single_file_to_session(page, first_file):
                return False
            
            # Wait for first file to process
            print("⏳ Waiting for first file to process...")
            self._wait_for_file_processing(page)
            
            # Upload remaining files one by one using "Add" button
            for i, file_path in enumerate(file_paths[1:], 2):
                print(f"📎 Adding file {i}/{len(file_paths)}: {os.path.basename(file_path)}...")
                if not self._add_additional_file_to_session(page, file_path):
                    print(f" Failed to add file: {os.path.basename(file_path)}")
                    return False
                
                # Wait between file uploads
                print("⏳ Waiting for file to process...")
                page.wait_for_timeout(5000)  # 5 second wait between files
            
            # Final wait for all files to be processed
            print("⏳ Final wait for all files to be processed...")
            self._wait_for_file_processing(page, max_attempts=5)
            
            print(f" Successfully uploaded all {len(file_paths)} files to the same notebook!")
            return True
            
        except Exception as e:
            print(f" Multiple file upload error: {e}")
            self.debug_page_state(page, "multiple_file_upload_error")
            return False

    def _upload_all_files_at_once(self, page, file_paths: list) -> bool:
        """Try to upload all files at once using file chooser multiple selection."""
        try:
            print(f"📎 Attempting to upload all {len(file_paths)} files at once...")
            
            # Click "Upload sources" button (based on specific XPath)
            upload_selectors = [
                # Specific XPaths provided
                'xpath=/html/body/div[7]/div[2]/div/mat-dialog-container/div/div/upload-dialog/div/div[2]/upload-main-screen/div[1]/button/span[3]',
                'xpath=/html/body/div[7]/div[2]/div/mat-dialog-container/div/div/upload-dialog/div/div[2]/upload-main-screen/div[1]/h4/span',
                
                # Fallback selectors
                'text="Upload sources"',
                'button:has-text("Upload sources")',
                ':has-text("Upload sources")',
                'button[aria-label="Upload sources from your computer"]',
                'button:has-text("Upload sources from your computer")'
            ]

            upload_clicked = False
            file_chooser = None
            
            # Try to click upload button and catch file chooser
            for selector in upload_selectors:
                try:
                    element = page.locator(selector).first
                    if element.count() > 0:
                        print(f"🔍 Attempting to click upload with: {selector}")
                        
                        # Set up file chooser listener before clicking
                        with page.expect_file_chooser(timeout=10000) as fc_info:
                            element.click()
                            
                        file_chooser = fc_info.value
                        upload_clicked = True
                        print(f" Clicked upload element and got file chooser with: {selector}")
                        break
                        
                except Exception as e:
                    print(f"   Failed with {selector}: {e}")
                    continue

            # Alternative: try to find file input directly if button click failed
            if not upload_clicked or not file_chooser:
                print(" Could not get file chooser, trying direct file input...")
                try:
                    file_inputs = page.locator('input[type="file"]')
                    if file_inputs.count() > 0:
                        print(f" Found {file_inputs.count()} file input(s), using first one")
                        # Try to set multiple files at once
                        file_inputs.first().set_input_files(file_paths)
                        print(f" All files uploaded directly: {[os.path.basename(f) for f in file_paths]}")
                        page.wait_for_timeout(5000)
                        self.debug_page_state(page, "04_direct_multiple_file_upload")
                        # Wait for all files to process
                        self._wait_for_file_processing(page, max_attempts=10)
                        return True
                    else:
                        print(" No file input found")
                        return False
                except Exception as e:
                    print(f" Direct multiple file input failed: {e}")
                    return False

            # If we got file chooser, set all files at once
            if file_chooser:
                print(f"📁 Setting all {len(file_paths)} files at once...")
                print(f"   Files: {[os.path.basename(f) for f in file_paths]}")
                
                # Use set_files with multiple files
                file_chooser.set_files(file_paths)
                page.wait_for_timeout(5000)
                self.debug_page_state(page, "03_after_multiple_file_select")
                
                # Wait for all files to process
                print("⏳ Waiting for all files to process...")
                self._wait_for_file_processing(page, max_attempts=15)
                
                print(f" All files uploaded successfully: {[os.path.basename(f) for f in file_paths]}")
                return True
            else:
                print(" No file chooser available")
                return False
                
        except Exception as e:
            print(f" Upload all files at once error: {e}")
            return False

    def _add_additional_file_to_session(self, page, file_path: str) -> bool:
        """Add an additional file to existing NotebookLM session."""
        try:
            # First, check if we can find the sources panel with existing files
            print("🔍 Looking for sources panel...")
            page.wait_for_timeout(2000)  # Wait for page to stabilize
            
            # Look for "Add" button or "+" button to add more sources
            add_selectors = [
                # Common add source buttons
                'button:has-text("Add")',
                'button[aria-label="Add source"]',
                'button[aria-label="Add more sources"]',
                'button:has-text("Add source")',
                'button:has-text("Add more")',
                'button:has-text("+")',
                'button[title="Add source"]',
                'button[title="Add more sources"]',
                
                # Specific patterns for NotebookLM
                'button:has-text("Upload")',
                'button:has-text("Upload more")',
                'button[aria-label="Upload more"]',
                
                # Alternative selectors
                '.add-source-button',
                '.add-button',
                '[data-testid="add-source"]',
                
                # Try to find any button with "add" or "upload" in class/text
                'button[class*="add"]',
                'button[class*="plus"]',
                'button[class*="upload"]'
            ]
            
            add_clicked = False
            file_chooser = None
            
            # Try to click add button and catch file chooser
            for selector in add_selectors:
                try:
                    elements = page.locator(selector)
                    if elements.count() > 0:
                        print(f"🔍 Trying add button: {selector} (found {elements.count()} elements)")
                        
                        # Try each matching element
                        for i in range(elements.count()):
                            try:
                                element = elements.nth(i)
                                if element.is_visible():
                                    print(f"   Clicking element {i+1}...")
                                    
                                    # Set up file chooser listener before clicking
                                    with page.expect_file_chooser(timeout=10000) as fc_info:
                                        element.click()
                                        
                                    file_chooser = fc_info.value
                                    add_clicked = True
                                    print(f" Successfully clicked add button with: {selector}")
                                    break
                            except Exception as e:
                                print(f"   Element {i+1} failed: {e}")
                                continue
                        
                        if add_clicked:
                            break
                        
                except Exception as e:
                    print(f"   Failed with {selector}: {e}")
                    continue
            
            # If no add button found, try the original upload sources flow
            if not add_clicked:
                print("🔍 No add button found, trying upload sources button...")
                return self._upload_single_file_to_session(page, file_path)
            
            # Set the file using the file chooser
            if file_chooser:
                print(f"📁 Setting additional file: {os.path.basename(file_path)}")
                file_chooser.set_files(file_path)
                page.wait_for_timeout(3000)
                print(f" Additional file uploaded: {os.path.basename(file_path)}")
                return True
            else:
                print(" No file chooser available for additional file")
                return False
                
        except Exception as e:
            print(f" Add additional file error: {e}")
            # Fallback to regular upload
            print("🔄 Falling back to regular upload method...")
            return self._upload_single_file_to_session(page, file_path)

    def _upload_single_file_to_session(self, page, file_path: str) -> bool:
        """Upload a single file to NotebookLM session (used for first file or fallback)."""
        try:
            print(f"📎 Uploading file: {os.path.basename(file_path)}...")
            
            # Click "Upload sources" button (based on specific XPath)
            upload_selectors = [
                # Specific XPaths provided
                'xpath=/html/body/div[7]/div[2]/div/mat-dialog-container/div/div/upload-dialog/div/div[2]/upload-main-screen/div[1]/button/span[3]',
                'xpath=/html/body/div[7]/div[2]/div/mat-dialog-container/div/div/upload-dialog/div/div[2]/upload-main-screen/div[1]/h4/span',
                
                # Fallback selectors
                'text="Upload sources"',
                'button:has-text("Upload sources")',
                ':has-text("Upload sources")',
                'button[aria-label="Upload sources from your computer"]',
                'button:has-text("Upload sources from your computer")'
            ]

            upload_clicked = False
            file_chooser = None
            
            # Try to click upload button and catch file chooser
            for selector in upload_selectors:
                try:
                    element = page.locator(selector).first
                    if element.count() > 0:
                        print(f"🔍 Attempting to click upload with: {selector}")
                        
                        # Set up file chooser listener before clicking
                        with page.expect_file_chooser(timeout=10000) as fc_info:
                            element.click()
                            
                        file_chooser = fc_info.value
                        upload_clicked = True
                        print(f" Clicked upload element and got file chooser with: {selector}")
                        break
                        
                except Exception as e:
                    print(f"   Failed with {selector}: {e}")
                    continue

            # Alternative: try to find file input directly if button click failed
            if not upload_clicked or not file_chooser:
                print(" Could not get file chooser, trying direct file input...")
                try:
                    file_inputs = page.locator('input[type="file"]')
                    if file_inputs.count() > 0:
                        print(f" Found {file_inputs.count()} file input(s), using first one")
                        # Check if file input supports multiple files
                        file_input = file_inputs.first()
                        multiple_attr = file_input.get_attribute("multiple")
                        print(f"📋 File input multiple attribute: {multiple_attr}")
                        
                        file_input.set_input_files(file_path)
                        print(f" File uploaded directly: {os.path.basename(file_path)}")
                        page.wait_for_timeout(3000)
                        self.debug_page_state(page, "04_direct_file_upload")
                        return True
                    else:
                        print(" No file input found")
                        self.debug_page_state(page, "no_file_input_found")
                        return False
                except Exception as e:
                    print(f" Direct file input failed: {e}")
                    return False

            # If we got file chooser, set the file
            if file_chooser:
                print(f"📁 Setting file: {os.path.basename(file_path)}")
                
                # Check if file chooser supports multiple files
                try:
                    # Get the input element to check for multiple attribute
                    page.wait_for_timeout(1000)
                    file_inputs = page.locator('input[type="file"]')
                    if file_inputs.count() > 0:
                        multiple_attr = file_inputs.first().get_attribute("multiple")
                        print(f"📋 File chooser multiple support: {multiple_attr}")
                except Exception as e:
                    print(f"📋 Could not check multiple attribute: {e}")
                
                file_chooser.set_files(file_path)
                page.wait_for_timeout(3000)
                self.debug_page_state(page, "03_after_file_select")
                
                # Wait for file processing
                self._wait_for_file_processing(page)
                
                print(f" File uploaded successfully: {os.path.basename(file_path)}")
                return True
            else:
                print(" No file chooser available")
                self.debug_page_state(page, "no_file_chooser")
                return False
                
        except Exception as e:
            print(f" Single file upload error: {e}")
            self.debug_page_state(page, "single_file_upload_error")
            return False

    def _upload_file_to_notebooklm(self, page, file_path: str) -> bool:
        """Upload file to NotebookLM (legacy method, redirects to single file upload)."""
        return self._upload_single_file_to_session(page, file_path)

    def _wait_for_file_processing(self, page, max_attempts: int = 20) -> bool:
        """Wait for NotebookLM to finish processing uploaded file with reload strategy."""
        print(f"⏳ Waiting for file processing (max {max_attempts} attempts)...")
        
        for attempt in range(1, max_attempts + 1):
            print(f"📋 Attempt {attempt}/{max_attempts}")
            
            # Wait 45 seconds before checking/reloading (increased for multiple files)
            print("   ⏰ Waiting 45 seconds...")
            page.wait_for_timeout(45000)  # 45 seconds
            
            # Reload page to check latest state
            print("   🔄 Reloading page...")
            try:
                page.reload(wait_until="load", timeout=10000)
                page.wait_for_timeout(3000)  # Wait for page to stabilize
                print("    Page reloaded successfully")
            except Exception as e:
                print(f"   ⚠️ Reload warning: {e}")
                continue
            
            # Check if file processing is complete by looking for Audio Overview button
            try:
                print("   🔍 Checking for Audio Overview button...")
                
                # Try to find Audio Overview button
                audio_overview_selectors = [
                    'button:has-text("Audio Overview")',
                    'text="Audio Overview"',
                    'button:has-text("Tổng quan âm thanh")',
                    '[aria-label*="Audio Overview"]'
                ]
                
                audio_found = False
                for selector in audio_overview_selectors:
                    try:
                        element = page.locator(selector).first
                        if element.count() > 0 and element.is_visible():
                            print(f"    Found Audio Overview button with: {selector}")
                            audio_found = True
                            break
                    except:
                        continue
                
                if audio_found:
                    print(f" File processing completed after {attempt} attempts!")
                    return True
                else:
                    print(f"    Audio Overview not available yet (attempt {attempt})")
                    
            except Exception as e:
                print(f"   ⚠️ Error checking Audio Overview: {e}")
            
            # If not the last attempt, continue waiting
            if attempt < max_attempts:
                print(f"   📋 Will try again in next cycle...")
            else:
                print(f"   ⏰ Max attempts reached, proceeding anyway...")
        
        print(f"⚠️ File processing timeout after {max_attempts} attempts, continuing anyway...")
        return True  # Continue even if we can't confirm processing is done

    def _upload_text_to_notebooklm(self, page, content: str) -> bool:
        """Upload text content to NotebookLM."""
        try:
            # Click "Copied text"
            print("📎 Adding copied text...")
            copied_selectors = [
                'text="Copied text"',
                'text="Văn bản đã sao chép"',
                'mat-chip:has-text("Copied text")',
                'mat-chip:has-text("Văn bản")',
                'mat-chip:has-text("văn bản")'
            ]

            copied_clicked = False
            for selector in copied_selectors:
                try:
                    chip = page.locator(selector).first
                    if chip.count() > 0:
                        chip.click()
                        copied_clicked = True
                        print(f"Clicked copied text with: {selector}")
                        break
                except:
                    continue

            if not copied_clicked:
                print(" Could not find Copied text chip")
                self.debug_page_state(page, "03_no_copied_text")
                return False

            page.wait_for_timeout(2000)
            self.debug_page_state(page, "04_after_copied_text_click")

            # Paste content
            print(f"✍️ Pasting {len(content)} chars...")
            dialog = page.get_by_role("dialog").first
            dialog.locator("textarea").first.fill(content)

            # Insert
            insert_selectors = [
                'text="Insert"',
                'text="Chèn"',
                'text="Thêm"',
                'button:has-text("Insert")',
                'button:has-text("Chèn")',
                'button:has-text("Thêm")'
            ]

            insert_clicked = False
            for selector in insert_selectors:
                try:
                    btn = page.locator(selector).first
                    if btn.count() > 0:
                        btn.click()
                        insert_clicked = True
                        print(f"Clicked insert with: {selector}")
                        break
                except:
                    continue

            if not insert_clicked:
                print(" Could not find Insert button")
                self.debug_page_state(page, "05_no_insert_button")
                return False
            
            page.wait_for_timeout(1500)
            self.debug_page_state(page, "06_after_insert_click")
            print(" Content uploaded successfully!")
            return True

        except Exception as e:
            print(f"Text upload error: {e}")
            return False

    def generate_audio_overview(self, page) -> bool:
        """Generate audio overview in NotebookLM."""
        try:
            print("🎵 Generating Audio Overview...", flush=True)
            print("🔍 Looking for Audio Overview button...", flush=True)
            self.debug_page_state(page, "07_before_audio_overview")

            # Look for Audio Overview button using best practices
            audio_overview_btn = None

            # Method 1: get_by_role for buttons - increased timeout for file uploads
            try:
                audio_overview_btn = page.get_by_role("button", name="Audio Overview")
                expect(audio_overview_btn).to_be_visible(timeout=15000)  # 15 seconds for file uploads
                print("Found Audio Overview with get_by_role")
            except Exception:
                try:
                    audio_overview_btn = page.get_by_role("button", name="Tổng quan âm thanh")
                    expect(audio_overview_btn).to_be_visible(timeout=15000)  # 15 seconds for file uploads
                    print("Found Audio Overview with get_by_role (Vietnamese)")
                except Exception as e:
                    print(f"   get_by_role failed: {e}")
                    audio_overview_btn = None

            # Method 2: get_by_text - increased timeout
            if not audio_overview_btn:
                try:
                    audio_overview_btn = page.get_by_text("Audio Overview", exact=False)
                    expect(audio_overview_btn).to_be_visible(timeout=15000)  # 15 seconds for file uploads
                    print("Found Audio Overview with get_by_text")
                except Exception:
                    try:
                        audio_overview_btn = page.get_by_text("Tổng quan âm thanh", exact=False)
                        expect(audio_overview_btn).to_be_visible(timeout=15000)  # 15 seconds for file uploads
                        print("Found Audio Overview with get_by_text (Vietnamese)")
                    except Exception as e:
                        print(f"   get_by_text failed: {e}")
                        audio_overview_btn = None

            # Method 3: Fallback with locators - increased timeout
            if not audio_overview_btn:
                selectors = [
                    'button:has-text("Audio Overview")',
                    'button:has-text("Tổng quan âm thanh")',
                    'button:has-text("tổng quan")'
                ]
                for selector in selectors:
                    try:
                        audio_overview_btn = page.locator(selector).first
                        expect(audio_overview_btn).to_be_visible(timeout=10000)  # 10 seconds for file uploads
                        print(f"Found Audio Overview with: {selector}")
                        break
                    except Exception:
                        continue
                else:
                    audio_overview_btn = None

            if not audio_overview_btn:
                print(" Audio Overview button not found")
                self.debug_page_state(page, "08_no_audio_overview_button")
                return False

            # Click Audio Overview button
            try:
                expect(audio_overview_btn).to_be_enabled(timeout=3000)
                audio_overview_btn.click()
                print(" Audio Overview clicked successfully", flush=True)
            except Exception as e:
                print(f" Failed to click Audio Overview: {e}", flush=True)
                self.debug_page_state(page, "09_failed_to_click_audio_overview")
                return False

            # Wait for UI to respond
            print("⏳ Waiting for audio generation to start...", flush=True)
            page.wait_for_timeout(3000)

            self.debug_page_state(page, "10_after_audio_overview_click")

            # Check for daily limits using best practices
            limit_messages = [
                "You have reached your daily Audio Overview limits",
                "Bạn đã đạt giới hạn",
                "đã đạt giới hạn",
                "giới hạn hàng ngày"
            ]

            for message in limit_messages:
                try:
                    limit_text = page.get_by_text(message, exact=False)
                    expect(limit_text).to_be_visible(timeout=1000)
                    print(" Daily limits reached!")
                    return False
                except Exception:
                    continue

            print(" Audio generation initiated")
            return True

        except Exception as e:
            print(f" Audio generation error: {e}")
            return False

    def wait_for_audio_completion(self, page, max_wait_minutes: int = 15) -> bool:
        """Simplified wait with reload + download retry."""
        print(f"⏳ Waiting for audio (max {max_wait_minutes} min)...")

        max_wait_time = max_wait_minutes * 60
        elapsed_time = 0
        last_reload = 0
        last_download = 0

        while elapsed_time < max_wait_time:
            # Auto-reload every 30 seconds ONLY after 5 minutes (300 seconds)
            if elapsed_time >= 300 and elapsed_time - last_reload >= 30:
                if self.perform_reload_and_try_download(page, elapsed_time):
                    return True
                last_reload = elapsed_time

            # Check if generating using better approach
            is_generating = False
            generating_messages = [
                "Generating",
                "Đang tạo",
                "Đang xử lý",
                "Processing"
            ]

            for message in generating_messages:
                try:
                    generating_text = page.get_by_text(message, exact=False)
                    expect(generating_text).to_be_visible(timeout=100)
                    is_generating = True
                    break
                except Exception:
                    continue

            if is_generating:
                print(f"   🔄 Still generating... ({elapsed_time//60}:{elapsed_time%60:02d})")
            else:
                # Check if audio ready using better approach
                audio_found = False

                # Check for duration indicators
                duration_indicators = ["phút", "minute", "min"]
                for indicator in duration_indicators:
                    try:
                        duration_text = page.get_by_text(indicator, exact=False)
                        expect(duration_text).to_be_visible(timeout=100)
                        audio_found = True
                        break
                    except Exception:
                        continue

                # Check for More button as audio ready indicator
                if not audio_found:
                    try:
                        more_btn = page.get_by_text("More", exact=False)
                        expect(more_btn).to_be_visible(timeout=100)
                        audio_found = True
                    except Exception:
                        try:
                            more_btn = page.get_by_text("Thêm", exact=False)
                            expect(more_btn).to_be_visible(timeout=100)
                            audio_found = True
                        except Exception:
                            pass

                # Check for artifact elements
                if not audio_found:
                    try:
                        artifact = page.locator("artifact-library-item").first
                        expect(artifact).to_be_visible(timeout=100)
                        audio_found = True
                    except Exception:
                        pass

                # Try download when audio ready and after minimum wait time
                if audio_found and elapsed_time >= 180:  # Wait at least 3 minutes
                    if self.try_download_method(page, "more"):
                        return True
                    # If download failed, wait longer before next attempt
                    page.wait_for_timeout(60000)  # Wait 60 more seconds
                    elapsed_time += 60

            page.wait_for_timeout(3000)  # 30 sec intervals
            elapsed_time += 30

        print(f" Timeout after {max_wait_minutes} minutes")
        return False

    def find_element_with_expect(self, page, selectors: list, description: str):
        """Find element using Playwright best practices with expect()."""
        for selector in selectors:
            try:
                candidate = page.locator(selector).first
                expect(candidate).to_be_visible(timeout=3000)
                return candidate
            except Exception as e:
                print(f"   Failed selector {selector}: {e}")
                continue
        print(f" Could not find {description}")
        return None

    def try_download_method(self, page, method: str) -> bool:
        """Try More menu download method."""
        page.wait_for_timeout(5000)

        print("📋 Trying More menu...")

        # Use the working XPath that was found
        try:
            more_btn = page.locator("//artifact-library-item//button[contains(@aria-label, 'More')]")
            expect(more_btn).to_be_visible(timeout=15000)
            print(" Found More button")
        except Exception as e:
            print(f" Could not find More button: {e}")
            return False

        # Wait for More button to be enabled (audio generation complete)
        print("   Waiting for More button to be enabled...")
        try:
            expect(more_btn).to_be_enabled(timeout=60000)  # Wait up to 60 seconds
            more_btn.click()
            print(" More button clicked")
        except Exception as e:
            print(f" More button not enabled within timeout: {e}")
            return False

        page.wait_for_timeout(3000)

        # Find download menu item using best practices
        print("   Looking for Download menu item...")
        dl_btn = None

        # Method 1: get_by_role for menu items
        try:
            dl_btn = page.get_by_role("menuitem", name="Download")
            expect(dl_btn).to_be_visible(timeout=3000)
            print(" Found Download with get_by_role")
        except Exception:
            try:
                dl_btn = page.get_by_role("menuitem", name="Tải xuống")
                expect(dl_btn).to_be_visible(timeout=3000)
                print(" Found Download with get_by_role (Vietnamese)")
            except Exception as e:
                print(f"   get_by_role for menuitem failed: {e}")
                dl_btn = None

        # Method 2: get_by_text for download text
        if not dl_btn:
            try:
                dl_btn = page.get_by_text("Download", exact=False)
                expect(dl_btn).to_be_visible(timeout=3000)
                print(" Found Download with get_by_text")
            except Exception:
                try:
                    dl_btn = page.get_by_text("Tải xuống", exact=False)
                    expect(dl_btn).to_be_visible(timeout=3000)
                    print(" Found Download with get_by_text (Vietnamese)")
                except Exception as e:
                    print(f"   get_by_text failed: {e}")
                    dl_btn = None

        # Method 3: Fallback with locators
        if not dl_btn:
            selectors = [
                '[role="menuitem"]:has-text("Download")',
                '[role="menuitem"]:has-text("Tải xuống")'
            ]
            for selector in selectors:
                try:
                    dl_btn = page.locator(selector).first
                    expect(dl_btn).to_be_visible(timeout=2000)
                    print(f" Found Download with: {selector}")
                    break
                except Exception:
                    continue
            else:
                dl_btn = None

        if not dl_btn:
            print(" Could not find Download menu item")
            return False

        # Execute download using best practices
        try:
            expect(dl_btn).to_be_enabled(timeout=3000)
            with page.expect_download(timeout=3000) as dl_info:
                dl_btn.click()
                print(" Download button clicked")

            download = dl_info.value
            suggested_filename = download.suggested_filename
            
            # Sanitize filename to prevent truncation and invalid characters
            safe_filename = self.sanitize_filename(suggested_filename)
            print(f" Download started: {suggested_filename}")
            if safe_filename != suggested_filename:
                print(f"   Sanitized to: {safe_filename}")

            # Wait for download to complete and save to our folder
            download_path = os.path.join(self.download_folder, safe_filename)
            download.save_as(download_path)
            print(f" Download saved to: {download_path}")

            return True
        except Exception as e:
            print(f" Download failed: {e}")
            return False
    
    def sanitize_filename(self, filename: str) -> str:
        """Sanitize filename to remove invalid characters and prevent truncation."""
        if not filename:
            return f"audio_{int(time.time())}.wav"
        
        # Remove or replace invalid characters for Windows/Linux
        # Keep only alphanumeric, spaces, hyphens, underscores, and dots
        sanitized = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', filename)
        
        # Replace multiple spaces/underscores with single one
        sanitized = re.sub(r'[_\s]+', '_', sanitized)
        
        # Ensure filename isn't too long (max 255 chars for most filesystems)
        # Keep extension
        name, ext = os.path.splitext(sanitized)
        if len(sanitized) > 255:
            max_name_len = 255 - len(ext) - 10  # Reserve space for extension and safety
            name = name[:max_name_len]
            sanitized = name + ext
        
        # Remove leading/trailing dots and spaces
        sanitized = sanitized.strip('. ')
        
        # If empty after sanitization, use timestamp
        if not sanitized or sanitized == ext:
            sanitized = f"audio_{int(time.time())}{ext if ext else '.wav'}"
        
        return sanitized

    def download_audio(self, page) -> bool:
        """Simplified download with dual strategy."""
        page.wait_for_timeout(3000)

        # Only try More menu method
        return self.try_download_method(page, "more")

    def check_playwright_installation(self) -> bool:
        """Check if Playwright is properly installed by launching a temp browser."""
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                browser.close()
            print("Playwright Chromium is available.")
            return True
        except Exception as e:
            print(f"Playwright check failed: {e}")
            return False

    def run_automation(self, content_source: str, max_wait_minutes: int = 45, files_content: Optional[list] = None, file_content: bytes = None, filename: str = None) -> bool:
        """Run complete NotebookLM automation workflow."""
        try:
            print("Starting NotebookLM Text-to-Speech Automation")
            print("=" * 60)

            # Check Playwright installation first
            if not self.check_playwright_installation():
                print("Please install Playwright browsers:")
                print("   pip install playwright")
                print("   playwright install chromium")
                return False

            # Handle file input if provided (multiple files or single file)
            file_paths = []
            if files_content:
                print(f"📁 Processing {len(files_content)} uploaded files...")
                for file_bytes, file_name in files_content:
                    file_path = self.save_temp_file(file_bytes, file_name)
                    if not file_path:
                        print(f" Failed to save uploaded file: {file_name}")
                        return False
                    file_paths.append(file_path)
                    print(f"    Saved: {file_name}")
                content = f"Multiple files uploaded ({len(files_content)} files)"
            elif file_content and filename:
                print(f"📁 Processing uploaded file: {filename}")
                file_path = self.save_temp_file(file_content, filename)
                if not file_path:
                    print(" Failed to save uploaded file")
                    return False
                file_paths = [file_path]
                content = "File uploaded"  # Placeholder text
            else:
                # Get text content
                content = self.get_content(content_source)
                if not content:
                    return False

            print(f"Content preview: {content[:100]}...")
            print(f"Using Chrome profile: {self.profile_path}")

            # Show login status
            if self.auto_login and self.email:
                print(f"🔐 Auto-login enabled with: {self.email[:15]}...")
            else:
                print("🔐 Using existing browser session (no auto-login)")

            # Launch browser
            try:
                print("Launching browser...")
                print(f"Download folder: {self.download_folder}")

                # Ensure both profile and download folders exist
                os.makedirs(self.profile_path, exist_ok=True)
                os.makedirs(self.download_folder, exist_ok=True)

                with sync_playwright() as p:
                    # Use persistent context to keep login state
                    # downloads_path + --download-default-directory ensures correct download location
                    browser = p.chromium.launch_persistent_context(
                        user_data_dir=self.profile_path,
                        headless=settings.notebooklm.headless,
                        downloads_path=self.download_folder,
                        args=[
                            f"--download-default-directory={self.download_folder}",
                            "--disable-blink-features=AutomationControlled",
                            "--disable-infobars",
                            "--disable-extensions",
                            "--no-sandbox",
                            "--disable-dev-shm-usage",
                            "--disable-web-security",
                            "--disable-features=VizDisplayCompositor",
                            "--disable-prompt-on-repost",
                            "--disable-background-downloads",
                            "--disable-backgrounding-occluded-windows"
                        ],
                    )

                    print("Browser launched successfully")
                    page = browser.new_page()

                    try:
                        # Upload content (either text or multiple files)
                        if not self.upload_content_to_notebooklm(page, content, file_paths):
                            return False

                        # Generate audio
                        if not self.generate_audio_overview(page):
                            return False

                        # Wait for completion and download
                        download_success = self.wait_for_audio_completion(
                            page, max_wait_minutes
                        )

                        # If wait_for_audio_completion didn't succeed, try download one more time
                        if not download_success:
                            print("🔄 Final download attempt...")
                            download_success = self.download_audio(page)

                        # Summary
                        print("\n Automation Workflow Completed!")
                        print("📊 Summary:")
                        print("   Content source: custom text")
                        print(f"   Content length: {len(content)} chars")
                        print("   Upload: SUCCESS")
                        print("   Audio generation: SUCCESS")
                        print(
                            f"   Download: {'SUCCESS' if download_success else 'FAILED'}"
                        )

                        print("\nBrowser staying open for manual check...")
                        print(f"Audio files saved to: {self.download_folder}")
                        page.wait_for_timeout(3000)

                        return True

                    except Exception as e:
                        print(f"Automation error: {e}")
                        print(f"Error details: {type(e).__name__}: {str(e)}")
                        self.debug_page_state(page, "error_state")
                        return False

                    finally:
                        try:
                            browser.close()
                        except Exception:
                            pass

            except Exception as browser_error:
                print(f"Browser launch error: {browser_error}")
                print(f"Error type: {type(browser_error).__name__}")
                print("Possible solutions:")
                print("   1. Install Playwright browsers: playwright install chromium")
                print("   2. Check Chrome installation")
                print("   3. Run as administrator")
                return False

        except Exception as e:
            print(f"Critical error: {e}")
            print(f"Error type: {type(e).__name__}")
            print("Error location: Content processing or setup")
            return False


def run_notebooklm_automation(
    content_source: str,
    debug_mode: bool = False,
    max_wait_minutes: int = 45,
    email: Optional[str] = None,
    password: Optional[str] = None,
    files_content: Optional[list] = None,
    file_content: bytes = None,
    filename: str = None,
) -> bool:
    """
    Run NotebookLM automation workflow.

    Args:
        content_source: Text content to convert to audio
        debug_mode: Enable debug screenshots and logs (use True to debug login issues)
        max_wait_minutes: Maximum wait time for audio generation (default 45 minutes for multiple files)
        email: Google account email (optional, for login)
        password: Google account password (optional, for login)
        files_content: List of (file_bytes, filename) tuples for multiple files (optional)
        file_content: File content as bytes (optional, for single file upload - legacy)
        filename: Original filename (optional, for single file upload - legacy)

    Returns:
        bool: True if successful, False otherwise
    """
    automation = NotebookLMAutomation(
        debug_mode=debug_mode, email=email, password=password
    )
    return automation.run_automation(content_source, max_wait_minutes, files_content, file_content, filename)


if __name__ == "__main__":
    print("NotebookLM Automation Manager")
    print("=" * 50)
    print("\nDirect execution not supported")
    print("Use the API endpoint to provide custom text")
