import * as React from "react"

export function InputFile() {
  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <label htmlFor="picture" className="text-sm font-medium leading-none">
        Picture
      </label>
      <input
        id="picture"
        type="file"
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      <p className="text-xs text-muted-foreground">
        Select a picture to upload.
      </p>
    </div>
  )
}