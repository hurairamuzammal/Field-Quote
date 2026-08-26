const items = [
  'Fault finding',
  'Consumer unit work',
  'EICR testing',
  'EV charger installs',
  'Secure quote approval',
  'Completion records',
];

export default function Marquee() {
  return (
    <div className="service-ribbon" aria-label="Electrical services and workflow">
      <div className="service-ribbon-plane" aria-hidden="true" />
      <div className="service-ribbon-band">
        <div className="service-ribbon-track">
          {[false, true].map((duplicate) => (
            <div
              className="service-ribbon-group"
              key={String(duplicate)}
              aria-hidden={duplicate || undefined}
            >
              {items.map((item) => (
                <span className="service-ribbon-item" key={item}>
                  {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
