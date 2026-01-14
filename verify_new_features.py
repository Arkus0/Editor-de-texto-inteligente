from playwright.sync_api import sync_playwright

def verify_new_features():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page Error: {err}"))

        try:
            print("Navigating to home...")
            page.goto("http://localhost:3000")
            page.wait_for_selector(".ProseMirror")

            # 1. Verify Toolbar
            print("Checking Toolbar...")
            # Check for a few toolbar buttons
            page.get_by_label("Toggle bold").wait_for()
            page.get_by_label("Toggle italic").wait_for()
            page.get_by_label("Heading 1").wait_for()

            # 2. Verify Evaluation Button
            print("Checking Evaluation Button...")
            eval_btn = page.get_by_role("button", name="Evaluar Trabajo")
            eval_btn.wait_for()

            # Click it (Might fail if text is too short, let's type first)
            print("Typing text for evaluation...")
            page.focus(".ProseMirror")
            page.keyboard.press("Control+A")
            page.keyboard.type("La sociedad líquida, concepto acuñado por Zygmunt Bauman, refiere a la fragilidad de los vínculos humanos en la posmodernidad. A diferencia de la modernidad sólida, donde las estructuras sociales eran firmes, hoy vivimos en una incertidumbre constante. Esto afecta la identidad, que se vuelve transitoria.")

            print("Clicking Evaluate...")
            eval_btn.click()

            # Check Dialog opens
            print("Checking Evaluation Dialog...")
            page.get_by_text("Evaluación del Profesor").wait_for()
            page.get_by_text("Leyendo tu trabajo...").wait_for()

            # Note: We can't verify the result without a real API key, but we verified the UI flow.
            # Wait a bit to capture the loading state in screenshot
            page.wait_for_timeout(2000)

            print("Taking screenshot...")
            page.screenshot(path="new_features_verification.png")
            print("Verification successful.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="new_features_error.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_new_features()
