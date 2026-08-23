import { SpecialtyCard } from './SpecialtyCard';
import Health from '../assets/good-health.png';
import Tooth from '../assets/broken-tooth.png';
import Eye from '../assets/eye-test.png';
import Skin from '../assets/dermatology.png';
import Mental from '../assets/mental-health.png';
import Pelvic from '../assets/pelvic-exam.png';

const specialties = [
  { name: 'Primary Care',   icon: Health,  specialty: 'General Physician' },
  { name: 'Dentist',        icon: Tooth,   specialty: 'Dentist'           },
  { name: 'Gynologist',     icon: Pelvic,  specialty: 'Gynologist'        },
  { name: 'Dermatologist',  icon: Skin,    specialty: 'Dermatologist'     },
  { name: 'Psychiatrist',   icon: Mental,  specialty: 'Psychiatrist'      },
  { name: 'Eye Doctor',     icon: Eye,     specialty: 'Ophthalmologist'   },
];

export function TopSpecialties() {
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {specialties.map((s) => (
          <SpecialtyCard
            key={s.name}
            icon={s.icon}
            name={s.name}
            to={`/search?specialty=${encodeURIComponent(s.specialty)}`}
          />
        ))}
      </div>
    </div>
  );
}
