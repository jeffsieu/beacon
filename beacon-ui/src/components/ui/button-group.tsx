import * as React from "react"
import { cn } from "@/lib/utils"

function ButtonGroup({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"div"> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(
        "group/button-group inline-flex items-center rounded-lg [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none [&>*:not(:first-child)]:-ml-px",
        orientation === "vertical" && "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none [&>*:not(:first-child)]:-mt-px [&>*:not(:first-child)]:ml-0",
        className,
      )}
      {...props}
    />
  )
}

function ButtonGroupSeparator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"span"> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <span
      role="separator"
      data-slot="button-group-separator"
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-5 w-px" : "h-px w-5",
        className,
      )}
      {...props}
    />
  )
}

function ButtonGroupText({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="button-group-text"
      className={cn(
        "inline-flex items-center px-2.5 text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText }
