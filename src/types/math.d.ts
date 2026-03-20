import * as React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        ref?: React.RefObject<any>;
        style?: React.CSSProperties;
        multiline?: string;
        'smart-mode'?: string;
        'smart-fence'?: string;
        'math-virtual-keyboard-policy'?: string;
        placeholder?: string;
      };
    }
  }
}
