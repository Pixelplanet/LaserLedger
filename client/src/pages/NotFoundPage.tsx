import { Link } from 'react-router-dom';
import PageBlock from '../components/PageBlock';

export default function NotFoundPage() {
  return (
    <PageBlock title="Not found" subtitle="The page you’re looking for doesn’t exist or has moved.">
      <p><Link to="/">← Back to browse</Link></p>
    </PageBlock>
  );
}
