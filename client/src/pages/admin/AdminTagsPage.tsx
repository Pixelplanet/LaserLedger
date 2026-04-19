import PageBlock from '../../components/PageBlock';
import { CrudTable } from '../../components/CrudTable';

interface Tag { id: number; name: string; slug: string; usage_count: number }

export default function AdminTagsPage() {
  return (
    <PageBlock title="Tags" subtitle="Folksonomy used to categorise settings.">
      <CrudTable<Tag>
        endpoint="/admin/tags"
        queryKey="admin-tags"
        fields={[
          { key: 'name', label: 'Name', required: true },
          { key: 'description', label: 'Description', type: 'textarea' },
        ]}
        displayColumns={[
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'slug', label: 'Slug' },
          { key: 'usage_count', label: 'Uses' },
        ]}
      />
    </PageBlock>
  );
}
