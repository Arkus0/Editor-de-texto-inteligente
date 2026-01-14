from playwright.sync_api import sync_playwright
import time

def verify_editor():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to home...")
            page.goto("http://localhost:3000")

            # Wait for editor to be visible
            page.wait_for_selector(".ProseMirror")
            print("Editor loaded.")

            # Select text to trigger bubble menu
            print("Selecting text...")
            page.focus(".ProseMirror")
            # Select first word or all
            page.keyboard.press("Control+A")

            # Wait for bubble menu button "Formalizar"
            print("Waiting for Formalizar button...")
            formalize_btn = page.get_by_role("button", name="Formalizar")
            formalize_btn.wait_for(state="visible", timeout=5000)

            print("Clicking Formalizar...")
            formalize_btn.click()

            # Wait for Popover content
            print("Waiting for options...")
            page.get_by_text("Sugerencias de Tono").wait_for(timeout=10000)

            # Wait for a specific unique part of the mock response to ensure it loaded
            page.get_by_text("En el contexto de la modernidad").wait_for()

            # Take screenshot including the popover
            print("Taking screenshot...")
            page.screenshot(path="verification_screenshot.png")
            print("Screenshot saved.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="error_screenshot.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_editor()
