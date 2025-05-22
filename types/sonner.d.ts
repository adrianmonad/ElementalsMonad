declare module 'sonner' {
  export const toast: {
    info: (title: string, options?: any) => void;
    success: (title: string, options?: any) => void;
    error: (title: string, options?: any) => void;
    loading: (title: string, options?: any) => void;
    message: (title: string, options?: any) => void;
    promise: <T>(promise: Promise<T>, options?: any) => Promise<T>;
    dismiss: () => void;
    custom: (component: any, options?: any) => void;
  };
  
  export interface ToasterProps {
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
    duration?: number;
    className?: string;
    style?: React.CSSProperties;
    theme?: 'light' | 'dark' | 'system';
    visibleToasts?: number;
    closeButton?: boolean;
    toastOptions?: any;
    offset?: string | number;
    gap?: number;
    invert?: boolean;
    expand?: boolean;
    richColors?: boolean;
  }
  
  export const Toaster: React.FC<ToasterProps>;
} 