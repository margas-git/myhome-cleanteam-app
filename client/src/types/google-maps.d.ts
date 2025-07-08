declare global {
  interface Window {
    google: {
      maps: {
        Geocoder: new () => {
          geocode(
            request: { address: string },
            callback: (results: any[], status: string) => void
          ): void;
        };
        Map: new (element: HTMLElement, options: any) => any;
        Marker: new (options: any) => any;
        LatLngBounds: new () => any;
        MapTypeId: {
          ROADMAP: string;
        };
        SymbolPath: {
          CIRCLE: string;
        };
        event: {
          addListenerOnce: (map: any, event: string, callback: () => void) => void;
        };
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