export default function Aluno({ nome, idade }: AlunoProps) {
    return (
        <h1> Aluno: {nome} {idade} </h1>
    )
}

interface AlunoProps {
    nome: string;
    idade: number;
}