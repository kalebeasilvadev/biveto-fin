const fs = require('fs');

async function testUpload() {
  console.log('=== TESTE DE UPLOAD COM SENHA ===\n');

  // 1. Login para obter token
  console.log('1. Fazendo login...');
  const loginResponse = await fetch('http://localhost:8000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'kalebeandradesilva@hotmail.com',
      password: '!Klb@9698'
    })
  });

  const loginData = await loginResponse.json();
  const token = loginData.access_token;
  console.log('✅ Login bem-sucedido!\n');

  // 2. Primeiro upload SEM senha (deve retornar 422)
  console.log('2. Tentando upload sem senha...');
  const fileBuffer = fs.readFileSync('/Users/kalebeandrade/Dev/geral/biveto-app/test-fatura.pdf');
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });

  const formData1 = new FormData();
  formData1.append('file', blob, 'Fatura.pdf');

  try {
    const response1 = await fetch('http://localhost:8000/api/v1/documents', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData1
    });

    if (response1.status === 422) {
      const detail = await response1.json();
      console.log('✅ Recebeu 422 como esperado');
      console.log('   Detail:', JSON.stringify(detail.detail, null, 2));

      if (detail.detail.error === 'password_required') {
        console.log('✅ password_required detectado!\n');

        // 3. Retry COM senha
        console.log('3. Fazendo retry com senha 049282...');
        const formData2 = new FormData();
        formData2.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), 'Fatura.pdf');
        formData2.append('password', '049282');

        const response2 = await fetch('http://localhost:8000/api/v1/documents', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData2
        });

        if (response2.ok) {
          const data = await response2.json();
          console.log('✅ UPLOAD COM SENHA BEM-SUCEDIDO!');
          console.log('   Status:', response2.status);
          console.log('   Document ID:', data.id);
          console.log('   Status do processamento:', data.status);
          console.log('   Itens extraídos:', data.extracted_items?.length || 0);

          if (data.extracted_items && data.extracted_items.length > 0) {
            console.log('\n📄 Primeiros 3 itens extraídos:');
            data.extracted_items.slice(0, 3).forEach((item, i) => {
              console.log(`   ${i + 1}. ${item.description}: R$ ${item.amount}`);
            });
          }

          console.log('\n✅ TESTE COMPLETO - TUDO FUNCIONANDO!');
        } else {
          const errorData = await response2.json();
          console.log('❌ FALHA NO RETRY COM SENHA');
          console.log('   Status:', response2.status);
          console.log('   Error:', JSON.stringify(errorData, null, 2));
        }
      }
    } else {
      console.log('❌ Status inesperado:', response1.status);
    }
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }
}

testUpload().catch(console.error);

