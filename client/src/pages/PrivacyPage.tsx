import { Link } from 'react-router-dom';
import PageBlock from '../components/PageBlock';

export default function PrivacyPage() {
  return (
    <PageBlock
      title="Privacy & cookies"
      subtitle="What we collect, why, and how to remove it."
    >
      <h2>Data we store</h2>
      <ul>
        <li>Account: email, hashed password, display name, optional bio &amp; avatar URL.</li>
        <li>Submissions, comments, votes, and uploaded images you choose to share.</li>
        <li>Server logs (IP, user agent) for security and abuse prevention, retained 30&nbsp;days.</li>
      </ul>
      <h2>Cookies</h2>
      <p>
        We set a single first-party session cookie (<code>ll_session</code>) when you sign in.
        It is HTTP-only, SameSite=Lax, and signed with a server secret. No third-party
        analytics, no tracking pixels.
      </p>
      <h2>Your rights</h2>
      <p>
        You can export all data linked to your account or delete the account permanently from
        the <Link to="/account">account page</Link>. Deletion anonymises your public posts.
      </p>
      <h2>Contact</h2>
      <p>
        For questions, open an issue on the project repository or email the maintainer listed
        in the README.
      </p>
    </PageBlock>
  );
}
