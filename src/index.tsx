import {
  Form,
  ActionPanel,
  Action,
  showToast,
  Toast,
  Clipboard,
  open,
  Detail,
} from "@raycast/api";
import { exec } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";
import { useState, useEffect } from "react";

const execAsync = promisify(exec);

interface FormValues {
  question: string;
}

export default function Command() {
  // Start in a loading state while capturing the screenshot.
  const [isLoading, setIsLoading] = useState(true);
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null);

  // Capture the screenshot as soon as the command loads.
  useEffect(() => {
    async function captureScreenshot() {
      try {
        // Allow a brief pause so the command UI may hide
        await new Promise((resolve) => setTimeout(resolve, 100));

        const tempFilePath = join(tmpdir(), `screenshot-${Date.now()}.png`);
        const screencapturePath = "/usr/sbin/screencapture";
        // Take the screenshot (this should now happen before the prompt is shown)
        await execAsync(`${screencapturePath} -x "${tempFilePath}"`);

        // Compress the image to reduce file size
        await execAsync(
          `sips -s format jpeg -s formatOptions 60 "${tempFilePath}" --out "${tempFilePath}"`,
        );

        setScreenshotPath(tempFilePath);
      } catch (error) {
        console.error("Screenshot capture error:", error);
        await showToast({
          style: Toast.Style.Failure,
          title: "Screenshot capture failed",
          message: String(error),
        });
      } finally {
        // Once the screenshot is captured (or fails), hide the loading view.
        setIsLoading(false);
      }
    }
    captureScreenshot();
  }, []);

  async function handleSubmit(values: FormValues) {
    if (!values.question.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Please enter a question",
      });
      return;
    }
    if (!screenshotPath) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Screenshot not available",
      });
      return;
    }

    try {
      // Copy screenshot to clipboard (already captured)
      await Clipboard.copy({ file: screenshotPath });
      const userQuestion = values.question;

      // Open T3.chat in Chrome
      await open("https://t3.chat");

      // Give time for the page to load
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // AppleScript to open a new chat, paste image, clear file name,
      // type question, and press Enter
      const applescript = `
        tell application "Google Chrome"
          activate
        end tell

        tell application "System Events"
          keystroke "0" using {command down, shift down}
          delay 0.2
          keystroke "v" using {command down}
          delay 0.2
          keystroke "a" using {command down}
          delay 0.1
          key code 51
          delay 0.1
          keystroke "${userQuestion.replace(/"/g, '\\"')}"
          delay 0.3
          key code 36
        end tell
      `;
      await execAsync(`osascript -e '${applescript}'`);

      await showToast({
        style: Toast.Style.Success,
        title: "T3 Speed Dial",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed",
        message: String(error),
      });
    }
  }

  // While loading, display a loading detail view.
  if (isLoading) {
    return <Detail markdown="Capturing screenshot..." />;
  }

  // Once the screenshot is ready, show the prompt form.
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Screenshot & Prompt"
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="question"
        title="New Chat Prompt"
        placeholder="Type or paste any context here (up to 2500 characters)"
        enableMarkdown={false}
      />
    </Form>
  );
}
