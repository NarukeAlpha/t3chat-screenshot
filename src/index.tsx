import {
    Form,
    ActionPanel,
    Action,
    showToast,
    Toast,
    Clipboard,
    open,
} from "@raycast/api";
import { exec } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";
import { useState } from "react";

const execAsync = promisify(exec);

interface FormValues {
    question: string;
}

export default function Command() {
    const [isLoading, setIsLoading] = useState(false);

    async function handleSubmit(values: FormValues) {
        if (!values.question.trim()) {
            await showToast({
                style: Toast.Style.Failure,
                title: "Please enter a question",
            });
            return;
        }

        setIsLoading(true);
        try {
            // 1. Take screenshot using full path for screencapture
            await showToast({
                style: Toast.Style.Animated,
                title: "Taking screenshot...",
            });
            const tempFilePath = join(tmpdir(), `screenshot-${Date.now()}.png`);
            const screencapturePath = "/usr/sbin/screencapture";
            await execAsync(`${screencapturePath} -x "${tempFilePath}"`);

            // 2. Compress the image to reduce file size
            // Convert to JPEG and lower the quality.
            // Adjust quality value as needed.
            await execAsync(
                `sips -s format jpeg -s formatOptions 60 "${tempFilePath}" --out "${tempFilePath}"`
            );

            // 3. Copy screenshot to clipboard
            await Clipboard.copy({ file: tempFilePath });
            const userQuestion = values.question;

            // 4. Open T3.chat in Chrome
            await open("https://t3.chat");

            // Wait for the page to load
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // 5-7. Use AppleScript to automate opening a new chat,
            // pasting the screenshot, and sending the question.
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
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Form
            actions={
                <ActionPanel>
                    <Action.SubmitForm title="Screenshot & prompt" onSubmit={handleSubmit} />
                </ActionPanel>
            }
            isLoading={isLoading}
        >
            <Form.TextArea
                id="question"
                title="New chat Prompt"
                placeholder="Type or paste any context here (up to 2500 characters)"
                enableMarkdown={false}
            />
        </Form>
    );
}
