# Quickstart: Extension DOM Demo

1. Run `npm test`.
2. In `chrome://extensions`, reload the unpacked `apps/chrome-extension` directory.
3. Open exactly `https://phongvu.vn/buildpc` and refresh after loading the extension.
4. Confirm launcher appears; verify it does not appear on `https://www.phongvu.vn/buildpc`, `/buildpc/anything`, product page or homepage.
5. Open panel and select **Thêm VGA demo**. Confirm action status is success, unverified or a named failure; do not continue to checkout. On failure, copy the `(DOM: {...})` diagnostic from panel or the `[BuildMate DOM demo]` DevTools console line.
6. Change the build manually and confirm the snapshot changes within two seconds or displays unavailable.
7. Test repeated click, close/cancel while waiting and a delayed/no-product modal.

## Bridge demo

The current build provides a mock command adapter only. A real OpenClaw bridge requires a configured/pairable Gateway node relay and the server-side `buildmate_request_ui` plugin tool; do not insert gateway tokens into extension files.
