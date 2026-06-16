import type { FC, PropsWithChildren } from 'react';
import { Toaster } from '@/components/ui/sonner';

const Layout: FC<PropsWithChildren> = (props) => {
  return (
    <main className="flex h-[100dvh] w-screen bg-[#FCF6E7]">
      {props.children}

      <Toaster />
    </main>
  );
};

export default Layout;
