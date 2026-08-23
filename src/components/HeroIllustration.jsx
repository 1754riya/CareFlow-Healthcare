export function HeroIllustration() {
    return (
      <div className="relative w-full h-full">
        <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
          <svg
            width="400"
            height="400"
            viewBox="0 0 400 400"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            <circle cx="200" cy="200" r="200" fill="#FEF3C7" fillOpacity="0.4" />
            <circle cx="200" cy="200" r="150" fill="#FDE68A" fillOpacity="0.4" />
            <circle cx="200" cy="200" r="100" fill="#FCD34D" fillOpacity="0.4" />
          </svg>
        </div>
      </div>
    );
  }