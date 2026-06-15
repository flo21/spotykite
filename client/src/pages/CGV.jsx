const sections = [
  ['Identification de la société', 'Spotykite édite un service en ligne permettant de découvrir, réserver ou offrir des stages et expériences de kitesurf proposés dans les écoles Spotykite. Les coordonnées complètes de la société éditrice sont communiquées sur demande et dans les documents de commande.'],
  ['Objet', 'Les présentes Conditions Générales de Vente définissent les modalités applicables aux réservations, cartes cadeaux et demandes effectuées via Spotykite. Toute commande implique l’acceptation sans réserve des présentes conditions.'],
  ['Réservation', 'La réservation devient effective après validation du paiement ou confirmation écrite par Spotykite lorsque le parcours le prévoit. Les informations communiquées par le client doivent être exactes afin de permettre l’organisation de la prestation.'],
  ['Validité des cartes cadeaux', 'Les cartes cadeaux Spotykite sont valables pendant 1 an à compter de leur date d’achat, sauf mention contraire indiquée lors de la commande. Elles sont utilisables selon les disponibilités des écoles Spotykite.'],
  ['Conditions physiques', 'La pratique du kitesurf nécessite de savoir nager et d’être dans un état de santé compatible avec une activité nautique. L’école peut refuser une participation si les conditions de sécurité ne sont pas réunies.'],
  ['Conditions météo', 'Les prestations dépendent des conditions météorologiques, notamment du vent, de l’état de la mer et de la sécurité du spot. En cas de conditions défavorables, un report peut être proposé.'],
  ['Annulation par le client', 'Toute demande d’annulation ou de modification doit être transmise à Spotykite dans les meilleurs délais. Les conditions de report, d’avoir ou de remboursement dépendent du délai de prévenance et de la formule réservée.'],
  ['Absence ou retard', 'En cas d’absence ou de retard du client le jour de la prestation, l’école peut considérer la session comme due si l’organisation ne permet pas un report. Il appartient au client de se présenter à l’heure convenue.'],
  ['Responsabilité', 'Spotykite agit comme service de réservation et d’accompagnement client. La réalisation de la prestation est assurée par l’école concernée, sous sa responsabilité pédagogique et opérationnelle.'],
  ['Assurance', 'Selon les formules et les écoles, une licence ou une assurance spécifique peut être requise. Le client est informé des conditions applicables avant la pratique lorsque ces éléments sont nécessaires.'],
  ['Droit de rétractation', 'Conformément à la réglementation applicable aux prestations de loisirs fournies à une date ou période déterminée, le droit de rétractation peut ne pas s’appliquer aux réservations datées. Pour les cartes cadeaux, les conditions applicables sont précisées lors de l’achat.'],
  ['Litiges', 'En cas de difficulté, le client est invité à contacter Spotykite afin de rechercher une solution amiable. À défaut d’accord, le litige sera soumis aux juridictions compétentes selon les règles de droit applicables.']
];

export default function CGV() {
  return (
    <main className="bg-bg">
      <section className="border-b border-border bg-gradient-to-br from-sky via-white to-sand px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="eyebrow text-primary">Informations légales</p>
          <h1 className="mt-3 text-5xl font-black leading-none text-navy sm:text-6xl">Conditions Générales de Vente</h1>
          <p className="mt-4 max-w-3xl text-base font-bold leading-relaxed text-muted">
            Ces conditions encadrent les réservations, cartes cadeaux et demandes effectuées sur Spotykite.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="mx-auto grid max-w-5xl gap-4">
          {sections.map(([title, text], index) => (
            <article key={title} className="card p-6 sm:p-8">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-ocean">{index + 1}. {title}</p>
              <p className="mt-3 text-base font-medium leading-8 text-text">{text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
