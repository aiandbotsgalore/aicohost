import { useEffect } from "react";

interface HotkeyConfig {
  key: string;
  command: string;
  description: string;
}

const defaultHotkeys: HotkeyConfig[] = [
  { key: 'r', command: 'riff', description: 'Riff on that' },
  { key: '1', command: 'oneLiner', description: 'One-liner only' },
  { key: 'w', command: 'wrap', description: 'Wrap in 10' },
  { key: 't', command: 'tone', description: 'Switch tone' },
  { key: 'p', command: 'pause', description: 'Pause AI' },
  { key: 's', command: 'skip', description: 'Skip turn' },
];

export function useHotkeys(onHotkey: (key: string, command: string) => void) {
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      // Only trigger if not typing in an input field
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement) {
        return;
      }

      // Ignore if modifier keys are pressed
      if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }

      const key = event.key.toLowerCase();
      const hotkey = defaultHotkeys.find(h => h.key === key);
      
      if (hotkey) {
        event.preventDefault();
        onHotkey(key, hotkey.command);
      }
    };

    document.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [onHotkey]);

  return defaultHotkeys;
}
