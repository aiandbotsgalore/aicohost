import { useState } from "react";

interface PersonalityControlsProps {
  personality: {
    voiceType: string;
    comedyLevel: number;
    researchLevel: number;
    energyLevel: number;
    responseStyle: string;
  };
  onPersonalityChange: (updates: Partial<PersonalityControlsProps['personality']>) => void;
}

const voiceOptions = [
  { value: 'energetic-podcaster', label: 'Energetic Podcaster' },
  { value: 'street-comedy-voice', label: 'Street Comedy Voice' },
  { value: 'geeky-ufo-researcher', label: 'Geeky UFO Researcher' },
  { value: 'professional-moderator', label: 'Professional Moderator' },
];

export function PersonalityControls({ personality, onPersonalityChange }: PersonalityControlsProps) {
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);

  const handleSliderChange = (key: keyof typeof personality, value: number) => {
    onPersonalityChange({ [key]: value });
  };

  const handleVoiceChange = (voiceType: string) => {
    onPersonalityChange({ voiceType });
  };

  const handleStyleChange = (responseStyle: string) => {
    onPersonalityChange({ responseStyle });
  };

  const previewVoice = (voiceType: string) => {
    setPreviewingVoice(voiceType);
    // TODO: Implement voice preview functionality
    setTimeout(() => setPreviewingVoice(null), 2000);
  };

  return (
    <div className="bg-card rounded-lg p-6 border border-border">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <i className="fas fa-masks-theater text-secondary"></i>
        Personality
      </h3>
      
      <div className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Current Voice</label>
          <select 
            className="w-full p-2 bg-input border border-border rounded-lg text-sm"
            value={personality.voiceType}
            onChange={(e) => handleVoiceChange(e.target.value)}
            data-testid="select-voice-type"
          >
            {voiceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors"
            onClick={() => previewVoice(personality.voiceType)}
            disabled={previewingVoice !== null}
            data-testid="button-preview-voice"
          >
            {previewingVoice ? 'Playing preview...' : 'Preview voice'}
          </button>
        </div>
        
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Personality Mix</label>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Comedy</span>
                <span data-testid="text-comedy-level">{personality.comedyLevel}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={personality.comedyLevel}
                onChange={(e) => handleSliderChange('comedyLevel', parseInt(e.target.value))}
                className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer slider"
                data-testid="slider-comedy"
              />
              <div className="h-1 bg-muted rounded-full -mt-1">
                <div 
                  className="h-full bg-secondary rounded-full transition-all duration-200"
                  style={{ width: `${personality.comedyLevel}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Research</span>
                <span data-testid="text-research-level">{personality.researchLevel}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={personality.researchLevel}
                onChange={(e) => handleSliderChange('researchLevel', parseInt(e.target.value))}
                className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer slider opacity-0"
                data-testid="slider-research"
              />
              <div className="h-1 bg-muted rounded-full -mt-1">
                <div 
                  className="h-full bg-accent rounded-full transition-all duration-200"
                  style={{ width: `${personality.researchLevel}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Energy Level</span>
                <span data-testid="text-energy-level">{personality.energyLevel}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={personality.energyLevel}
                onChange={(e) => handleSliderChange('energyLevel', parseInt(e.target.value))}
                className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer slider opacity-0"
                data-testid="slider-energy"
              />
              <div className="h-1 bg-muted rounded-full -mt-1">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-200"
                  style={{ width: `${personality.energyLevel}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Response Style</label>
          <div className="grid grid-cols-2 gap-2">
            <button 
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                personality.responseStyle === 'conversational'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              onClick={() => handleStyleChange('conversational')}
              data-testid="button-conversational-style"
            >
              Conversational
            </button>
            <button 
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                personality.responseStyle === 'formal'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              onClick={() => handleStyleChange('formal')}
              data-testid="button-formal-style"
            >
              Formal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
