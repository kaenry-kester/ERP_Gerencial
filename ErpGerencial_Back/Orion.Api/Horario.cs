namespace Orion.Api;

/// <summary>Datas no horário de Brasília (o banco guarda em UTC; os dias do Financeiro e do histórico são locais).</summary>
public static class Horario
{
    public static readonly TimeZoneInfo Brasilia = TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");

    /// <summary>Meia-noite (Brasília) do dia, em UTC.</summary>
    public static DateTime InicioDoDiaUtc(DateOnly dia) =>
        TimeZoneInfo.ConvertTimeToUtc(dia.ToDateTime(TimeOnly.MinValue), Brasilia);

    /// <summary>Um instante UTC no horário de Brasília.</summary>
    public static DateTime Local(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Brasilia);

    public static DateOnly Hoje => DateOnly.FromDateTime(Local(DateTime.UtcNow));
}
