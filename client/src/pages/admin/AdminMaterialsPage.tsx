import PageBlock from '../../components/PageBlock';
import { CrudTable } from '../../components/CrudTable';

interface Material { id: number; name: string; slug: string; category_id: number | null; is_active: boolean }

export default function AdminMaterialsPage() {
  return (
    <PageBlock title="Materials" subtitle="Reference data: laser-engravable materials.">
      <CrudTable<Material>
        endpoint="/admin/materials"
        queryKey="admin-materials"
        fields={[
          { key: 'name', label: 'Name', required: true },
          { key: 'category_id', label: 'Category ID', type: 'number' },
          { key: 'description', label: 'Description', type: 'textarea' },
          { key: 'is_active', label: 'Active', type: 'boolean' },
        ]}
        displayColumns={[
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'slug', label: 'Slug' },
          { key: 'category_id', label: 'Category' },
        ]}
      />
    </PageBlock>
  );
}
