interface FeedItem {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  tone: string;
}

interface ActivityFeedProps {
  items: FeedItem[];
  emptyLabel?: string;
}

export function ActivityFeed({
  items,
  emptyLabel = "No items to show.",
}: ActivityFeedProps) {
  if (items.length === 0) {
    return <div className="empty-state">{emptyLabel}</div>;
  }

  return (
    <div className="activity-feed">
      {items.map((item) => (
        <article key={item.id} className="activity-feed__item">
          <span className={`tone-chip tone-chip--${item.tone}`}>{item.tone}</span>
          <div>
            <h3 className="activity-feed__title">{item.title}</h3>
            <p className="activity-feed__subtitle">{item.subtitle}</p>
          </div>
          <div className="activity-feed__meta">{item.meta}</div>
        </article>
      ))}
    </div>
  );
}
