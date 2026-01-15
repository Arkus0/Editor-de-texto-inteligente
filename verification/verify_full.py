from playwright.sync_api import sync_playwright

def verify_full():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Large viewport to ensure everything renders
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})

        try:
            print("Navigating to localhost:3000...")
            page.goto("http://localhost:3000")
            page.wait_for_load_state('networkidle')

            # 1. Verify Auth Button
            print("Checking Auth Button...")
            auth_btn = page.locator("button:has-text('Acceder')")
            if auth_btn.count() > 0 and auth_btn.is_visible():
                print("SUCCESS: Auth Button found.")
            else:
                print("FAILURE: Auth Button not found.")
                # Print toolbar html for debug
                print(page.locator("div.sticky.top-0").inner_html())

            # 2. Verify Bibliography Manager
            print("Checking Bibliography Manager...")
            # Using the title attribute to find the button
            bib_btn = page.locator("button[title='Gestor Bibliográfico']")
            if bib_btn.count() > 0:
                print("SUCCESS: Bibliography button found.")
                bib_btn.click()

                # Wait for dialog
                print("Waiting for Bibliography Dialog...")
                page.wait_for_selector("text=Mis Referencias", timeout=5000)

                # Check for DOI section
                if page.locator("text=Autocompletar con DOI").is_visible():
                    print("SUCCESS: DOI section found.")
                else:
                    print("FAILURE: DOI section not found.")
            else:
                print("FAILURE: Bibliography button not found.")

        except Exception as e:
            print(f"ERROR: {e}")
            page.screenshot(path="error_state.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_full()
