from playwright.sync_api import sync_playwright

def verify_features():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page Error: {err}"))

        try:
            print("Navigating to home...")
            page.goto("http://localhost:3000")

            # 1. Verify Sidebar initial state
            print("Checking sidebar...")
            page.wait_for_selector("text=Bienvenido a SocioFlow")

            # 2. Verify Repetition Button
            print("Selecting text for repetition...")
            page.wait_for_selector(".ProseMirror", timeout=10000) # Reduced timeout for faster feedback
            page.focus(".ProseMirror")
            page.keyboard.type("sociedad sociedad sociedad") # Type repetition
            page.keyboard.press("Control+A")

            print("Clicking Analizar Repeticiones...")
            # Wait for bubble menu to appear
            page.get_by_role("button", name="Analizar Repeticiones").click()

            # Check if popover shows "Palabras Repetidas"
            print("Checking Repetition Popover...")
            page.get_by_text("Palabras Repetidas").wait_for()
            page.get_by_text("sociedad").first.wait_for()

            # Close popover (click editor)
            page.click(".ProseMirror")

            # 3. Verify Connector Button (Floating Menu)
            # We need an empty line or start of paragraph.
            print("Checking Connector Button...")
            page.keyboard.press("Enter") # New line
            page.keyboard.press("Enter")

            # Floating menu should appear. Look for the Link icon button.
            # It has title "Sugerir conectores"
            conn_btn = page.get_by_title("Sugerir conectores")
            conn_btn.wait_for()
            conn_btn.click()

            print("Checking Connector Popover...")
            page.get_by_text("Conectores Sugeridos").wait_for()

            # 4. Verify Export Button
            print("Checking Export Button...")
            page.get_by_title("Exportar HTML").wait_for()

            print("Taking final screenshot...")
            page.screenshot(path="final_features_verification.png")
            print("Verification successful.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="final_error.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_features()
