import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiMapPin } from 'react-icons/fi';

export function SearchBar({ initialQuery = '', initialLocation = '' }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [location, setLocation] = useState(initialLocation);

  const handleSearch = (e) => {
    e.preventDefault();
    // Navigate to the search page with updated query parameters
    navigate(`/search?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}`);
  };

  return (
    <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-lg p-4">
      <div className="flex">
        {/* Search Doctors & Specialties Section */}
        <div className="w-2/3 flex items-center border-r border-gray-200 pr-2">
          <div className="px-4">
            <FiSearch className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search doctors, specialties"
            className="w-full py-3 px-2 outline-none text-gray-700"
          />
        </div>

        {/* Location Section */}
        <div className="w-1/3 flex items-center pl-2">
          <div className="px-2">
            <FiMapPin className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className="w-full py-3 px-2 outline-none text-gray-700"
          />
        </div>

        {/* Search Button */}
        <button
          type="submit"
          className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-6 py-3 rounded-md font-medium transition-colors ml-2"
        >
          Search
        </button>
      </div>
    </form>
  );
}