import { ExampleForm } from "@/components/example-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export default function ShadcnDemo() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background p-4 border-b border-border">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">shadcn/ui Demo</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/">
              <Button variant="outline">← Back to Home</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-8 space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold">Welcome to shadcn/ui!</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Your shadcn/ui setup is complete! Below are examples of the
            components you can now use in your project. All components are fully
            customizable and work seamlessly with Tailwind CSS v4.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Example Form */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Example Form</h3>
            <ExampleForm />
          </div>

          {/* Button Variants */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Button Variants</h3>
            <Card>
              <CardHeader>
                <CardTitle>Button Examples</CardTitle>
                <CardDescription>
                  Different button styles and sizes available
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button>Default</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon">🚀</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Available Components */}
        <Card>
          <CardHeader>
            <CardTitle>Available Components</CardTitle>
            <CardDescription>
              Components you can now add to your project using pnpm dlx
              shadcn@latest add [component-name]
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div className="space-y-1">
                <p className="font-medium">Form Components</p>
                <ul className="text-muted-foreground space-y-0.5">
                  <li>• input</li>
                  <li>• label</li>
                  <li>• textarea</li>
                  <li>• checkbox</li>
                  <li>• radio-group</li>
                  <li>• select</li>
                  <li>• form</li>
                </ul>
              </div>
              <div className="space-y-1">
                <p className="font-medium">Layout</p>
                <ul className="text-muted-foreground space-y-0.5">
                  <li>• card</li>
                  <li>• separator</li>
                  <li>• tabs</li>
                  <li>• accordion</li>
                  <li>• collapsible</li>
                  <li>• sidebar</li>
                </ul>
              </div>
              <div className="space-y-1">
                <p className="font-medium">Feedback</p>
                <ul className="text-muted-foreground space-y-0.5">
                  <li>• alert</li>
                  <li>• badge</li>
                  <li>• progress</li>
                  <li>• skeleton</li>
                  <li>• toast</li>
                  <li>• sonner</li>
                </ul>
              </div>
              <div className="space-y-1">
                <p className="font-medium">Overlays</p>
                <ul className="text-muted-foreground space-y-0.5">
                  <li>• dialog</li>
                  <li>• sheet</li>
                  <li>• popover</li>
                  <li>• tooltip</li>
                  <li>• dropdown-menu</li>
                  <li>• context-menu</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
            <CardDescription>
              How to continue building with shadcn/ui
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Add more components:</h4>
              <code className="block bg-muted p-2 rounded text-sm">
                pnpm dlx shadcn@latest add dialog toast dropdown-menu
              </code>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Browse all components:</h4>
              <p className="text-sm text-muted-foreground">
                Visit{" "}
                <a
                  href="https://ui.shadcn.com/docs/components"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:no-underline"
                >
                  ui.shadcn.com/docs/components
                </a>{" "}
                to see all available components with examples and documentation.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Customize themes:</h4>
              <p className="text-sm text-muted-foreground">
                Edit the CSS variables in{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-xs">
                  app/globals.css
                </code>{" "}
                to customize your color scheme.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
