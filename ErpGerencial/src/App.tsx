import Header from './components/header'
import Aluno from './components/alunos'

export default function App() {
  return (
    <div>
      <Header />
      <hr />
      <h1>Hello World!</h1>
      <Aluno nome="Melissa" idade={27} />
    </div>
  )
}