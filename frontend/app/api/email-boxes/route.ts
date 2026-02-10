import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const MOCKMAIL_API_BASE_URL = process.env.MOCKMAIL_API_BASE_URL || 'https://api.mockmail.dev';

interface EmailBox {
  address: string;
  createdAt: string;
  updatedAt: string;
}

interface UserBoxes {
  email: string;
  name: string;
  userId: string;
  totalBoxes: number;
  boxes: EmailBox[];
}

interface BoxesData {
  summary: {
    totalUsers: number;
    totalBoxes: number;
    averageBoxesPerUser: number;
  };
  users: UserBoxes[];
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('mockmail_access_token');
    if (!accessToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const response = await fetch(`${MOCKMAIL_API_BASE_URL}/api/mail/boxes-by-user`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 10 }, // Cache reduzido para 10 segundos para dados mais atualizados
      cache: 'no-store' // Força busca de dados frescos em desenvolvimento
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }

    const data: BoxesData = await response.json();
    
    // Ordenar os dados por data de criação (mais recente primeiro)
    const sortedData: BoxesData = {
      ...data,
      users: data.users.map(user => ({
        ...user,
        boxes: [...user.boxes].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      })).sort((a, b) => {
        // Ordenar usuários pela data de criação da caixa mais recente
        const mostRecentA = Math.max(...a.boxes.map(box => new Date(box.createdAt).getTime()));
        const mostRecentB = Math.max(...b.boxes.map(box => new Date(box.createdAt).getTime()));
        return mostRecentB - mostRecentA;
      })
    };
    
    return NextResponse.json(sortedData);
  } catch (error) {
    console.error('Error fetching email boxes data:', error);
    return NextResponse.json(
      { 
        message: 'Failed to fetch email boxes data',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
