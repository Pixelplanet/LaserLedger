import { Link } from 'react-router-dom';
import PageBlock from '../components/PageBlock';

export default function HomePage() {
  return (
    <>
      <PageBlock
        title="Community laser recipes, minus the guesswork"
        subtitle="Find proven xTool settings, compare variants, and publish reproducible results with attached source data."
      >
        <div className="grid">
          <Link className="cta" to="/search">Browse settings</Link>
          <Link className="nav-link" to="/submit">Submit a setting</Link>
        </div>
      </PageBlock>
      <PageBlock title="Why LaserLedger" subtitle="Built for experimentation, moderation, and quality at scale.">
        <div className="grid">
          <div><h2>Strong metadata</h2><p>Device, laser type, material, operation, and parameter-level search.</p></div>
          <div><h2>Image variants</h2><p>Automatic original/card/thumb processing for clean browsing performance.</p></div>
          <div><h2>Moderation workflow</h2><p>Queue review, duplicate detection, and action logging.</p></div>
        </div>
      </PageBlock>
    </>
  );
}
