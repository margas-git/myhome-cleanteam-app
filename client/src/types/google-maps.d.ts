declare global {
  interface Window {
    google: {
      maps: {
        places: {
          AutocompleteService: new () => {
            getPlacePredictions(
              request: {
                input: string;
                componentRestrictions?: { country: string };
                types?: string[];
              },
              callback: (predictions: Array<{
                description: string;
                place_id: string;
                structured_formatting: {
                  main_text: string;
                  secondary_text: string;
                };
              }> | null, status: string) => void
            ): void;
          };
          AutocompleteSuggestion: new () => {
            getPlacePredictions(request: {
              input: string;
              componentRestrictions?: { country: string };
              types?: string[];
            }): Promise<{
              predictions: Array<{
                description: string;
                place_id: string;
                structured_formatting: {
                  main_text: string;
                  secondary_text: string;
                };
              }>;
            }>;
          };
          PlacesServiceStatus: {
            OK: string;
            ZERO_RESULTS: string;
            OVER_QUERY_LIMIT: string;
            REQUEST_DENIED: string;
            INVALID_REQUEST: string;
          };
        };
      };
    };
  }
}

export {}; 