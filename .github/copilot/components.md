## Components

- Shared components should be placed in the `lib/zoonk_web/components` directory.
- When coding, check the available components first to see if there's a component that can be used for what you're trying to accomplish. Use a shared component whenever available. If a component is not available, create it. Make changes to existing components if necessary to accommodate new use cases.
- When creating a new component, import it in the `html_helpers` function of the `lib/zoonk_web.ex` file, so that it can be used by default in all templates without the need to import it in each module.
- Add a `@moduledoc` to each module and a `@doc` to each function/component, including examples of how to use the component.
- Group related components together. For example, the `flash.ex` contains both `flash` and `flash_group` components.
- Add `Phoenix.Component.attr/3` to each component to define the attributes it accepts. Include the `doc` option to provide documentation for each attribute.
- Components modules are prefixed with `ZoonkWeb.Components` (e.g., `ZoonkWeb.Components.Flash`).
- Turn repetitive code into components. However, for code specific to a section (e.g. authentication), keep it in the section's directory instead of `lib/zoonk_web/components`. For example, `lib/zoonk_web/live/users/user_components.ex` contains components specific to the user section.
- When you want to style a component like `<.card_content>`, add a class to it (i.e. `<.card_content class="flex flex-col gap-4">`) instead of creating a div inside the component just for styling.
- When creating a component, also create a preview for it in the `lib/zoonk_dev/ui_preview` directory following the same pattern from other components placed there. For example, when creating/updating `lib/zoonk_web/components/anchor.ex`, also create/update `lib/zoonk_dev/ui_preview/anchor_preview.ex`.
- When adding a component to the `lib/zoonk_dev/ui_preview` directory, also create a router for it in the `/ui` scope along with the other component routes - and update the `lib/zoonk_dev/ui_preview_layout.ex` file to include the new component in the menu list, alphabetically ordered.
- When updating a component, also update its preview in the `lib/zoonk_dev/ui_preview` directory.
- When conditionally adding a class to a component, convert it to a list and use the `@variant == :primary && ""` pattern. For example, `class={[@variant == :primary && "bg-zk-primary"]}`.
- When adding text, make sure to use the `<.text>` component instead of plain text. For example, instead of `<h1>Title</h1>`, use `<.text tag="h1">Title</.text>`.
- For components with inner blocks, use `{render_slot(@inner_block)}` to render the inner block. Never use only {@inner_block} or <%= @inner_block %> or <%= render_slot(@inner_block) %>.
- Make sure your components are accessible.
