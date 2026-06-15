export default function FAQ() {
  const items = [
    ['Que se passe-t-il si le vent manque ?', 'La securite passe avant tout. L ecole propose un report gratuit si les conditions ne permettent pas une session utile et sure.'],
    ['Faut-il deja etre sportif ?', 'Non. Les baptemes sont concus pour debuter progressivement avec du materiel adapte et un moniteur diplome.'],
    ['Le materiel est-il inclus ?', 'Oui, aile, planche, combinaison, casque et gilet sont inclus dans les offres de demonstration.'],
    ['Comment fonctionne une Carte Cadeau SpotyKite ?', 'Vous choisissez une experience ou un montant, ajoutez un message, puis le beneficiaire reserve sa date dans une ecole Spotykite.']
  ];
  return (
    <main className="section">
      <p className="eyebrow">FAQ</p>
      <h1 className="max-w-3xl text-5xl font-black">Des reponses simples avant de prendre le vent</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {items.map(([q, a]) => (
          <article key={q} className="card p-6">
            <h2 className="text-xl font-black">{q}</h2>
            <p className="mt-3 text-muted">{a}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
