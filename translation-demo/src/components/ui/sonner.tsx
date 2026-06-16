import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    className="toaster group"
    toastOptions={{
      classNames: {
        toast:
          'group toast group-[.toaster]:bg-white group-[.toaster]:text-stone-950 group-[.toaster]:border-stone-200 group-[.toaster]:shadow-lg',
        description: 'group-[.toast]:text-stone-500',
      },
    }}
    {...props}
  />
);

export { Toaster };
