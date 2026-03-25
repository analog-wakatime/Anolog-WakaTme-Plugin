import * as vscode from 'vscode'

let channel: vscode.OutputChannel | undefined

export const output = {
  init(context: vscode.ExtensionContext) {
    if (!channel) {
      channel = vscode.window.createOutputChannel('Analog WakaTime')
      context.subscriptions.push(channel)
    }
    return channel
  },

  show(preserveFocus = true) {
    channel?.show(preserveFocus)
  },

  line(message: string) {
    channel?.appendLine(message)
  },

  info(message: string) {
    output.line(`[info] ${message}`)
  },

  warn(message: string) {
    output.line(`[warn] ${message}`)
  },

  error(message: string) {
    output.line(`[error] ${message}`)
  },
}

