const fs = require('fs');

async function testUpload() {
  console.log('=== TESTE DE UPLOAD SEM SENHA ===\n');

  // 1. Login
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

  // 2. Upload PDF SEM senha
  console.log('2. Fazendo upload do PDF sem senha...');
  const fileBuffer = fs.readFileSync('/Users/kalebeandrade/Dev/geral/biveto-app/test-fatura-sem-senha.pdf');

  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), 'fatura-sem-senha.pdf');

  const response = await fetch('http://localhost:8000/api/v1/documents', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  const data = await response.json();
  console.log('✅ UPLOAD CONCLUÍDO');
  console.log('   Status:', response.status);
  console.log('   Document ID:', data.id);
  console.log('   Status do processamento:', data.status);
  console.log('   Itens extraídos:', data.extracted_items?.length || 0);

  if (data.extracted_items && data.extracted_items.length > 0) {
    console.log('\n📄 Todos os itens extraídos:');
    data.extracted_items.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.description}: R$ ${item.amount}`);
    });
  }

  if (data.card_info) {
    console.log('\n💳 Info do cartão:');
    console.log('   Emissor:', data.card_info.card_issuer);
    console.log('   Total da fatura:', data.card_info.total_amount);
  }
}

testUpload().catch(console.error);
