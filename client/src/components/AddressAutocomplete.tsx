import { useState, useRef, useEffect } from 'react';
import { useGoogleMaps } from '../hooks/useGoogleMaps';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function AddressAutocomplete({ 
  value, 
  onChange, 
  placeholder = "Enter address...", 
  required = false,
  className = ""
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isLoaded: isGoogleLoaded } = useGoogleMaps();

  // Fallback suggestions for when Google API is not available
  const fallbackSuggestions = [
    "123 Collins Street, Melbourne",
    "456 Bourke Street, Melbourne", 
    "789 Flinders Street, Melbourne",
    "321 Queen Street, Melbourne",
    "654 Swanston Street, Melbourne",
    "100 Elizabeth Street, Melbourne",
    "200 Lonsdale Street, Melbourne",
    "300 Russell Street, Melbourne"
  ];

  const getPlacePredictions = (input: string) => {
    if (input.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (isGoogleLoaded && window.google?.maps?.places?.AutocompleteService) {
      // Use the working AutocompleteService API
      try {
        const autocompleteService = new window.google.maps.places.AutocompleteService();
        autocompleteService.getPlacePredictions(
          {
            input,
            componentRestrictions: { country: 'au' },
            types: ['address']
          },
          (predictions: any[] | null, status: string) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
              const formattedPredictions = predictions.map(prediction => {
                let address = prediction.description;
                address = address.replace(/,\s*[A-Z]{2,3}\s+\d{4}$/, '');
                return address;
              });
              
              // Smart filtering to remove similar addresses
              const filteredPredictions = formattedPredictions.filter(prediction => {
                const inputLower = input.toLowerCase();
                const predictionLower = prediction.toLowerCase();
                
                // Don't show exact matches
                if (predictionLower === inputLower) return false;
                
                // Don't show addresses that are too similar (likely variations of the same address)
                const inputWords = inputLower.split(/\s+/).filter((word: string) => word.length > 2);
                const predictionWords = predictionLower.split(/\s+/).filter((word: string) => word.length > 2);
                
                // If they share most of the same words, filter out the prediction
                const commonWords = inputWords.filter((word: string) => predictionWords.includes(word));
                const similarity = commonWords.length / Math.max(inputWords.length, predictionWords.length);
                
                // If similarity is too high (>70%), filter it out
                return similarity < 0.7;
              });
              
              setSuggestions(filteredPredictions);
              setShowSuggestions(filteredPredictions.length > 0);
              setSelectedIndex(-1);
            } else {
              // Fallback to local suggestions
              useFallbackSuggestions(input);
            }
          }
        );
      } catch (error) {
        console.warn('Google Places API error, using fallback:', error);
        useFallbackSuggestions(input);
      }
    } else {
      // Use fallback suggestions
      useFallbackSuggestions(input);
    }
  };

  const useFallbackSuggestions = (input: string) => {
    const inputLower = input.toLowerCase();
    const filtered = fallbackSuggestions.filter(suggestion => {
      const suggestionLower = suggestion.toLowerCase();
      
      // Don't show exact matches
      if (suggestionLower === inputLower) return false;
      
      // Don't show addresses that are too similar
      const inputWords = inputLower.split(/\s+/).filter((word: string) => word.length > 2);
      const suggestionWords = suggestionLower.split(/\s+/).filter((word: string) => word.length > 2);
      
      const commonWords = inputWords.filter((word: string) => suggestionWords.includes(word));
      const similarity = commonWords.length / Math.max(inputWords.length, suggestionWords.length);
      
      // If similarity is too high (>70%), filter it out
      return similarity < 0.7 && suggestionLower.includes(inputLower);
    });
    
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
    setSelectedIndex(-1);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      getPlacePredictions(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [value, isGoogleLoaded]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Clear suggestions if input is empty or matches a suggestion exactly
    if (newValue.length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  const handleBlur = () => {
    // Use a shorter timeout to prevent race conditions
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }, 150);
  };

  const handleFocus = () => {
    if (value.length >= 3 && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        required={required}
        className={className}
        placeholder={placeholder}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              onClick={() => handleSelectSuggestion(suggestion)}
              className={`px-3 py-2 cursor-pointer text-sm ${
                index === selectedIndex 
                  ? 'bg-blue-100 text-blue-900' 
                  : 'hover:bg-gray-100'
              }`}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 